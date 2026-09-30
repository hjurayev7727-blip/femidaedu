// Femida Edu — Q2 ko'rgazmasi (P7, EDU ostida o'ngda). O'rnatish: brand-w10.mjs dagi paketlar.
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

// Q2 ko'rgazmasi. Kichik o'lchamda EDU o'qilishi uchun kattaroq (small=true).
function q2(c, size, small = false) {
  const a = T(P7, "Femida", size), k = size / 164, es = small ? 44 * k : 30 * k, tr = small ? 10 * k : 12 * k;
  const e = T(montM, "EDU", es, tr); const y = a.bottom + (small ? 50 : 44) * k;
  return { body: put(a, 0, 0, c.ink, { dotI: c.gold }) + put(e, a.w - e.w - 4 * k, y, c.gold), w: a.w, top: a.top, bottom: y };
}
fs.writeFileSync("S-light.svg", svg(1200, 420, place(q2(NAVY, 200), 1200, 420), NAVY.bg));
fs.writeFileSync("S-dark.svg", svg(1200, 420, place(q2(DARK, 200), 1200, 420), DARK.bg));
{ const d = q2(NAVY, 46, true); const menu = ["Sertifikat", "Huquq sohalari", "Testlarim", "Reyting"];
  let mx = 520; const m = menu.map((t) => { const tt = T(montM, t, 16, 0.3); const out = put(tt, mx, 58, "#33415C"); mx += tt.w + 44; return out; }).join("");
  const btn = `<rect x="1120" y="30" width="140" height="44" rx="8" fill="${NAVY.ink}"/>` + put(T(montS, "Kirish", 16, 0.5), 1165, 58, "#FFFFFF");
  fs.writeFileSync("S-header.svg", svg(1300, 104, `<rect y="103" width="1300" height="1" fill="#E3E6EC"/><g transform="translate(40 ${52 - (d.bottom + d.top) / 2})">${d.body}</g>` + m + btn, "#FFFFFF")); }
{ const f = T(P7, "F", 300), e = T(montM, "EDU", 50, 8); const fx = 256 - f.w / 2, fy = 236 - (f.top + f.bottom) / 2;
  fs.writeFileSync("S-avatar.svg", svg(512, 512, put(f, fx, fy, DARK.ink) + put(e, 256 - e.w / 2 + 40, fy + 70, DARK.gold), DARK.bg)); }
{ const d = q2(DARK, 70, true); const L = (t, y, f = montM, s = 15, c = DARK.ink) => put(T(f, t, s, 0.4), 48, y, c);
  fs.writeFileSync("S-card.svg", svg(700, 400, `<g transform="translate(48 ${60 - d.top})">${d.body}</g><rect x="48" y="200" width="60" height="2" fill="${DARK.gold}"/>` +
    L("Ism Familiya", 254, montS, 22) + L("Asoschi", 284, montM, 15, DARK.gold) + L("femidaedu.uz  ·  @FemidaEduBot", 344, montM, 15), DARK.bg)); }
{ const d = q2(NAVY, 78, true); const SCf = F("playfair-display-sc", 700), tenorF = F("tenor-sans", 400), P6i = F("playfair-display", 600, "italic");
  const c = (t, y, f, s, col = NAVY.ink, tr = 1) => { const x = T(f, t, s, tr); return put(x, 500 - x.w / 2, y, col); };
  fs.writeFileSync("S-cert.svg", svg(1000, 700, `<rect x="24" y="24" width="952" height="652" fill="none" stroke="${NAVY.gold}" stroke-width="2"/><rect x="34" y="34" width="932" height="632" fill="none" stroke="${NAVY.gold}" stroke-width="0.8"/>` +
    `<g transform="translate(${500 - d.w / 2} ${90 - d.top})">${d.body}</g>` + c("SERTIFIKAT", 290, SCf, 40, NAVY.ink, 8) + c("MEHNAT HUQUQI", 346, tenorF, 20, NAVY.gold, 6) +
    c("Ali Valiyev", 440, P6i, 56) + `<rect x="330" y="465" width="340" height="1.2" fill="${NAVY.gold}"/>` + c("nazoratli imtihonni 86% natija bilan topshirdi", 510, montM, 17, "#4B5B70", 0.3) +
    c("No. FE-2026-000142  ·  femidaedu.uz/c/000142", 616, montM, 13, "#8A93A3", 0.5), "#FFFFFF")); }
