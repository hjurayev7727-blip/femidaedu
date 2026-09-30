// Femida Edu — yonma-yon variantlar (R1–R8). O'rnatish: brand-w10.mjs dagi paketlar.
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



const P4 = F("playfair-display", 400);
const n2 = n;
// Yonma-yon variantlar. Hammasida: Playfair 700 "Femida", oltin "i" nuqtasi.
function R(kind, c, size = 164) {
  const k = size / 164, a = T(P7, "Femida", size), capTop = a.top; // "F" tepasi
  const xh = T(P7, "x", size); const xTop = xh.top; // kichik harf balandligi
  let body = put(a, 0, 0, c.ink, { dotI: c.gold }), w = a.w, top = a.top, bottom = a.bottom;
  const gap = 26 * k;
  if (kind === "rule") { const e = T(montM, "EDU", 44 * k, 14 * k); const x = a.w + gap; const mid = xTop / 2;
    body += `<rect x="${x}" y="${capTop + 8 * k}" width="${2.5 * k}" height="${-capTop - 8 * k}" fill="${c.gold}"/>` + put(e, x + 24 * k, mid - (e.top + e.bottom) / 2, c.gold); w = x + 24 * k + e.w; }
  if (kind === "italic") { const e = T(P6i, "Edu", size); body += put(e, a.w + 18 * k, 0, c.gold); w = a.w + 18 * k + e.w; }
  if (kind === "badge") { const e = T(montS, "EDU", 40 * k, 6 * k); const h = -xTop, bx = a.w + gap, pw = 20 * k;
    body += `<rect x="${bx}" y="${xTop}" width="${e.w + pw * 2}" height="${h}" rx="${10 * k}" fill="${c.gold}"/>` + put(e, bx + pw, xTop / 2 - (e.top + e.bottom) / 2, c.bg); w = bx + e.w + pw * 2; }
  if (kind === "stack") { const hgt = -capTop; const s = hgt / 3.25; const x = a.w + gap;
    ["E", "D", "U"].forEach((ch, i) => { const e = T(montS, ch, s * 1.12); body += put(e, x + (s * 0.9 - e.w) / 2, capTop + (i + 1) * (hgt / 3) - (hgt / 3 - (e.bottom - e.top)) / 2, c.gold); });
    body += `<rect x="${x - 12 * k}" y="${capTop}" width="${2 * k}" height="${hgt}" fill="${c.gold}"/>`; w = x + s * 0.9; }
  if (kind === "joined") { const e = T(P4, "Edu", size); body += put(e, a.w + 2 * k, 0, c.gold); w = a.w + 2 * k + e.w; }
  if (kind === "vertical") { const e = T(montM, "EDU", 40 * k, 10 * k); const x = a.w + gap + (e.bottom - e.top);
    body += `<g transform="translate(${n2(x)} 0) rotate(-90)">${put(e, 0, -e.bottom, c.gold)}</g>`; w = x + 4 * k; }
  if (kind === "diamond") { const e = T(montM, "EDU", 50 * k, 14 * k); const d = 11 * k, cx = a.w + gap + d, cy = xTop / 2;
    body += `<path d="M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z" fill="${c.gold}"/>` + put(e, cx + d + gap, cy - (e.top + e.bottom) / 2, c.ink); w = cx + d + gap + e.w; }
  if (kind === "outline") { const e = T(P7, "EDU", size * 0.62, 6 * k); const x = a.w + gap;
    body += e.g.map((gl) => `<path transform="translate(${n2(x)} 0)" fill="none" stroke="${c.gold}" stroke-width="${2.2 * k}" d="${gl.d}"/>`).join(""); w = x + e.w; }
  return { body, w, top, bottom };
}
const place = (d, W, H) => { const h = d.bottom - d.top; return `<g transform="translate(${n((W - d.w) / 2)} ${n((H - h) / 2 - d.top)})">${d.body}</g>`; };
const LIGHT = { ...NAVY }, DK = { ...DARK };
const KINDS = [["R1", "R1 — ingichka oltin chiziq bilan ajratilgan", "rule"], ["R2", "R2 — Femida to'g'ri, Edu kursiv oltin", "italic"],
  ["R3", "R3 — EDU oltin nishonchada", "badge"], ["R4", "R4 — E·D·U ustun bo'lib, F balandligida", "stack"],
  ["R5", "R5 — bitta so'z: Femida qalin + Edu ingichka oltin", "joined"], ["R6", "R6 — EDU tik (vertikal)", "vertical"],
  ["R7", "R7 — oltin romb bilan ajratilgan", "diamond"], ["R8", "R8 — EDU kontur (ichi bo'sh) oltin", "outline"]];
for (const [key, , kind] of KINDS) {
  fs.writeFileSync(`${key}.svg`, svg(1200, 340, place(R(kind, LIGHT), 1200, 340), LIGHT.bg));
  fs.writeFileSync(`${key}-dark.svg`, svg(1200, 340, place(R(kind, DK), 1200, 340), DK.bg));
  const d = R(kind, LIGHT, 44); const menu = ["Sertifikat", "Huquq sohalari", "Testlarim", "Reyting"];
  let mx = 560; const m = menu.map((t) => { const tt = T(montM, t, 16, 0.3); const out = put(tt, mx, 58, "#33415C"); mx += tt.w + 44; return out; }).join("");
  const btn = `<rect x="1120" y="30" width="140" height="44" rx="8" fill="${NAVY.ink}"/>` + put(T(montS, "Kirish", 16, 0.5), 1165, 58, "#FFFFFF");
  fs.writeFileSync(`${key}-header.svg`, svg(1300, 104, `<rect y="103" width="1300" height="1" fill="#E3E6EC"/><g transform="translate(40 ${52 - (d.bottom + d.top) / 2})">${d.body}</g>` + m + btn, "#FFFFFF"));
}
fs.writeFileSync("names7.json", JSON.stringify(Object.fromEntries(KINDS.map(([k, nm]) => [k, nm]))));
