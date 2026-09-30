// Femida Edu — R3 (EDU oltin nishonchada) 4 shriftda: S1–S4. O'rnatish: brand-w10.mjs va brand-wordmarks.mjs dagi paketlar.
/* eslint-disable @typescript-eslint/no-unused-vars -- generatorlar umumiy shrift/yordamchi sarlavhasini bo'lishadi */
// Femida Edu — W10 uslubi (Playfair Display + yuqori o'ngda kichik EDU): variantlar, ranglar va qo'llanish.
import opentype from "opentype.js";
import fs from "node:fs";
const F = (p, w, st = "normal") => { const b = fs.readFileSync(new URL(`./node_modules/@fontsource/${p}/files/${p}-latin-${w}-${st}.woff`, import.meta.url)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const n = (v) => Math.round(v * 100) / 100;
const cmd = (c) => c.type === "M" || c.type === "L" ? `${c.type}${n(c.x)} ${n(c.y)}` : c.type === "Q" ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === "C" ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : "Z";
// harf → konturlar (i nuqtasini alohida bo'yash uchun)
function T(font, str, size, tr = 0) {
  const sc = size / font.unitsPerEm; let x = 0; const g = []; let t = Infinity, b = -Infinity;
  for (const ch of str) {
    const gl = font.charToGlyph(ch); const p = gl.getPath(x, 0, size); const bb = p.getBoundingBox();
    if (isFinite(bb.y1)) { t = Math.min(t, bb.y1); b = Math.max(b, bb.y2); }
    const contours = []; for (const c of p.commands) { if (c.type === "M") contours.push({ d: "", minY: Infinity }); const k = contours.at(-1); k.d += cmd(c); if ("y" in c) k.minY = Math.min(k.minY, c.y); }
    g.push({ ch, d: contours.map((k) => k.d).join(""), contours }); x += gl.advanceWidth * sc + tr;
  }
  return { g, w: x - tr, top: t, bottom: b };
}
const put = (t, x, y, fill, opt = {}) => t.g.map((gl, i) => {
  if (opt.dotI && gl.ch === "i" && gl.contours.length > 1) { const top = gl.contours.reduce((a, c) => (c.minY < a.minY ? c : a)); return gl.contours.map((c) => `<path transform="translate(${n(x)} ${n(y)})" fill="${c === top ? opt.dotI : fill}" d="${c.d}"/>`).join(""); }
  return `<path transform="translate(${n(x)} ${n(y)})" fill="${fill}" d="${gl.d}"/>`; }).join("");
const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;

const pf = (w, st) => F("playfair-display", w, st);
const P5 = pf(500), P7 = pf(700), P9 = pf(900), P6i = pf(600, "italic"), SC = F("playfair-display-sc", 700), montM = F("montserrat", 500), montS = F("montserrat", 600), tenor = F("tenor-sans", 400);
const NAVY = { bg: "#FFFFFF", ink: "#0E2340", gold: "#B08A3A" }, DARK = { bg: "#0E2340", ink: "#F4EFE3", gold: "#CFAB5E" };



const bodoni = F("bodoni-moda", 600), gara7 = F("eb-garamond", 700), cinzel = F("cinzel", 600), tenor2 = F("tenor-sans", 400), ral7 = F("raleway", 700);
// R3 uslubi: nom + oltin nishonchadagi EDU. Nishoncha balandligi = kichik harf (yoki bosh harf) balandligi.
const FONTS = [
  ["S1", "S1 — Playfair Display (hozirgi)", P7, "Femida", montS, true],
  ["S2", "S2 — Bodoni Moda (kontrastli, jurnal uslubi)", bodoni, "Femida", montS, true],
  ["S3", "S3 — EB Garamond (klassik, kitobiy)", gara7, "Femida", tenor2, true],
  ["S4", "S4 — Cinzel (rim yozuvi, bosh harflar)", cinzel, "FEMIDA", ral7, false],
];
function mark(font, word, bf, dot, c, size = 164) {
  const k = size / 164, a = T(font, word, size, word === "FEMIDA" ? 10 * k : 0);
  const ref = T(font, word === "FEMIDA" ? "E" : "x", size); const hTop = ref.top; const h = -hTop;
  const e = T(bf, "EDU", h * 0.52, h * 0.1); const pw = h * 0.3, bx = a.w + 24 * k;
  const body = put(a, 0, 0, c.ink, { dotI: dot ? c.gold : null }) +
    `<rect x="${bx}" y="${hTop}" width="${e.w + pw * 2}" height="${h}" rx="${h * 0.16}" fill="${c.gold}"/>` + put(e, bx + pw, hTop / 2 - (e.top + e.bottom) / 2, c.bg);
  return { body, w: bx + e.w + pw * 2, top: a.top, bottom: a.bottom };
}
function avatar(font, word, bf, c) {
  const f = T(font, word[0], 290); const ref = T(font, word === "FEMIDA" ? "E" : "x", 290); const h = -ref.top * 0.42;
  const e = T(bf, "EDU", h * 0.55, h * 0.1), pw = h * 0.3, bw = e.w + pw * 2;
  const fx = 256 - f.w / 2 - 10, fy = 236 - (f.top + f.bottom) / 2, bx = 256 - bw / 2 + 40, by = fy + 30;
  return put(f, fx, fy, c.ink) + `<rect x="${bx}" y="${by}" width="${bw}" height="${h}" rx="${h * 0.16}" fill="${c.gold}"/>` + put(e, bx + pw, by + h / 2 - (e.top + e.bottom) / 2, c.bg);
}
const place = (d, W, H) => { const h = d.bottom - d.top; return `<g transform="translate(${n((W - d.w) / 2)} ${n((H - h) / 2 - d.top)})">${d.body}</g>`; };
for (const [key, , font, word, bf, dot] of FONTS) {
  fs.writeFileSync(`${key}.svg`, svg(1200, 340, place(mark(font, word, bf, dot, NAVY), 1200, 340), NAVY.bg));
  fs.writeFileSync(`${key}-dark.svg`, svg(1200, 340, place(mark(font, word, bf, dot, DARK), 1200, 340), DARK.bg));
  fs.writeFileSync(`${key}-avatar.svg`, svg(512, 512, avatar(font, word, bf, DARK), DARK.bg));
  const d = mark(font, word, bf, dot, NAVY, 44); const menu = ["Sertifikat", "Huquq sohalari", "Testlarim", "Reyting"];
  let mx = 560; const m = menu.map((t) => { const tt = T(montM, t, 16, 0.3); const out = put(tt, mx, 58, "#33415C"); mx += tt.w + 44; return out; }).join("");
  const btn = `<rect x="1120" y="30" width="140" height="44" rx="8" fill="${NAVY.ink}"/>` + put(T(montS, "Kirish", 16, 0.5), 1165, 58, "#FFFFFF");
  fs.writeFileSync(`${key}-header.svg`, svg(1300, 104, `<rect y="103" width="1300" height="1" fill="#E3E6EC"/><g transform="translate(40 ${52 - (d.bottom + d.top) / 2})">${d.body}</g>` + m + btn, "#FFFFFF"));
}
fs.writeFileSync("names8.json", JSON.stringify(Object.fromEntries(FONTS.map(([k, nm]) => [k, nm]))));
