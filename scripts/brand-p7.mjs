// Femida Edu — P7 (oltin i nuqtasi), EDU pastda: Q1–Q4. O'rnatish: brand-w10.mjs dagi paketlar.
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


// EDU pastda: pos = "right" (pastki o'ng, asosiy chiziqda) | "under-right" (ostida, o'ngga tekis) | "under-center" (ostida, markazda) | "under-rule" (ostida, chiziqlar orasida)
function mark(pos, c, size = 164) {
  const a = T(P7, "Femida", size), k = size / 164;
  let body = put(a, 0, 0, c.ink, { dotI: c.gold }), w = a.w, bottom = a.bottom;
  if (pos === "right") { const e = T(montM, "EDU", 30 * k, 8 * k); body += put(e, a.w + 14 * k, 0, c.gold); w = a.w + 14 * k + e.w; }
  if (pos === "under-right") { const e = T(montM, "EDU", 30 * k, 12 * k); const y = a.bottom + 44 * k; body += put(e, a.w - e.w - 4 * k, y, c.gold); bottom = y; }
  if (pos === "under-center") { const e = T(montM, "EDU", 30 * k, 22 * k); const y = a.bottom + 46 * k; body += put(e, (a.w - e.w) / 2, y, c.gold); bottom = y; }
  if (pos === "under-rule") { const e = T(montM, "EDU", 28 * k, 20 * k); const y = a.bottom + 46 * k, lw = (a.w - e.w) / 2 - 22 * k;
    body += `<rect x="0" y="${y - 11 * k}" width="${lw}" height="${1.8 * k}" fill="${c.gold}"/><rect x="${a.w - lw}" y="${y - 11 * k}" width="${lw}" height="${1.8 * k}" fill="${c.gold}"/>` + put(e, (a.w - e.w) / 2, y, c.gold); bottom = y; }
  return { body, w, top: a.top, bottom };
}
const place = (d, W, H) => { const h = d.bottom - d.top; return `<g transform="translate(${n((W - d.w) / 2)} ${n((H - h) / 2 - d.top)})">${d.body}</g>`; };
const POS = [["Q1", "Q1 — EDU pastki o'ngda (asosiy chiziqda)", "right"], ["Q2", "Q2 — EDU ostida, o'ngga tekis", "under-right"],
  ["Q3", "Q3 — EDU ostida, markazda", "under-center"], ["Q4", "Q4 — EDU ostida, chiziqlar orasida", "under-rule"]];
for (const [k, , pos] of POS) { fs.writeFileSync(`${k}.svg`, svg(1200, 360, place(mark(pos, NAVY), 1200, 360), NAVY.bg)); fs.writeFileSync(`${k}-dark.svg`, svg(1200, 360, place(mark(pos, DARK), 1200, 360), DARK.bg)); }
fs.writeFileSync("names5.json", JSON.stringify(Object.fromEntries(POS.map(([k, nm]) => [k, nm]))));
// Qo'llanish (Q2 bilan): sayt sarlavhasi, vizitka
for (const [k, , pos] of POS) {
  const d = mark(pos, NAVY, 46); const menu = ["Sertifikat", "Huquq sohalari", "Testlarim", "Reyting"];
  let mx = 520; const m = menu.map((t) => { const tt = T(montM, t, 16, 0.3); const out = put(tt, mx, 58, "#33415C"); mx += tt.w + 44; return out; }).join("");
  const btn = `<rect x="1120" y="30" width="140" height="44" rx="8" fill="${NAVY.ink}"/>` + put(T(montS, "Kirish", 16, 0.5), 1165, 58, "#FFFFFF");
  fs.writeFileSync(`${k}-header.svg`, svg(1300, 104, `<rect y="103" width="1300" height="1" fill="#E3E6EC"/><g transform="translate(40 ${52 - (d.bottom + d.top) / 2})">${d.body}</g>` + m + btn, "#FFFFFF"));
}
