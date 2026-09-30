// Femida Edu — W10 uslubi: variantlar (P1–P9), ranglar va qo'llanish namunalari. O'rnatish: @fontsource/{playfair-display,playfair-display-sc,montserrat,tenor-sans} + opentype.js
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

// Asosiy konstruktor: Femida + yuqori o'ngda EDU
function mark({ font = P7, size = 164, edu = montM, eduSize = 30, eduTr = 8, dotI = false, box = false, rule = false, slogan = false }, c) {
  const a = T(font, "Femida", size), e = T(edu, "EDU", eduSize, eduTr);
  const ex = a.w + 14, ey = a.top - e.top + 4; let body = put(a, 0, 0, c.ink, { dotI: dotI ? c.gold : null });
  if (box) { const px = 8, py = 7; body += `<rect x="${ex - px}" y="${ey + e.top - py}" width="${e.w + px * 2}" height="${e.bottom - e.top + py * 2}" fill="none" stroke="${c.gold}" stroke-width="1.6"/>`; }
  body += put(e, ex + (box ? 2 : 0), ey, c.gold); let bottom = a.bottom, w = ex + e.w + (box ? 10 : 0);
  if (rule) { body += `<rect x="0" y="${a.bottom + 18}" width="${a.w}" height="2" fill="${c.gold}"/>`; bottom = a.bottom + 20; }
  if (slogan) { const s = T(tenor, "HUQUQ BO'YICHA HAMMASI BIR JOYDA", 22, 5.5); body += put(s, (a.w - s.w) / 2, a.bottom + 52, c.ink); bottom = a.bottom + 56; w = Math.max(w, s.w); }
  return { body, w, top: a.top, bottom };
}
const V = [
  ["P1", "P1 — Asl W10 (Playfair 700)", {}],
  ["P2", "P2 — Qalinroq (Playfair 900)", { font: P9, edu: montS }],
  ["P3", "P3 — Yengilroq (Playfair 500) + Tenor EDU", { font: P5, edu: tenor, eduTr: 10 }],
  ["P4", "P4 — Kursiv (Playfair Italic)", { font: P6i }],
  ["P5", "P5 — EDU ham serif (Playfair SC)", { edu: SC, eduSize: 32, eduTr: 4 }],
  ["P6", "P6 — EDU ramkada (belgi kabi)", { eduSize: 24, eduTr: 6, box: true }],
  ["P7", "P7 — \"i\" nuqtasi oltin", { dotI: true }],
  ["P8", "P8 — Ostida oltin chiziq", { rule: true }],
  ["P9", "P9 — Shior bilan", { slogan: true }],
];
const place = (d, W, H) => { const h = d.bottom - d.top; return `<g transform="translate(${n((W - d.w) / 2)} ${n((H - h) / 2 - d.top)})">${d.body}</g>`; };
for (const [k, , o] of V) { fs.writeFileSync(`${k}.svg`, svg(1200, 360, place(mark(o, NAVY), 1200, 360), NAVY.bg)); fs.writeFileSync(`${k}-dark.svg`, svg(1200, 360, place(mark(o, DARK), 1200, 360), DARK.bg)); }
fs.writeFileSync("names4.json", JSON.stringify(Object.fromEntries(V.map(([k, nm]) => [k, nm]))));

// Ranglar: P7 (asl + oltin nuqta) 6 palitrada
const PAL = [["To'q ko'k + oltin", "#FFFFFF", "#0E2340", "#B08A3A"], ["Qora + oltin", "#FFFFFF", "#141414", "#B08A3A"], ["Bordo + oltin", "#FBF7F0", "#6B1E2E", "#B08A3A"],
  ["Zumrad + oltin", "#FFFFFF", "#0B4F43", "#B08A3A"], ["Oq, to'q ko'k fonda", "#0E2340", "#FFFFFF", "#CFAB5E"], ["Oq, qora fonda", "#141414", "#FFFFFF", "#CFAB5E"]];
PAL.forEach(([nm, bg, ink, gold], i) => fs.writeFileSync(`pal${i}.svg`, svg(1200, 360, place(mark({ dotI: true }, { ink, gold }), 1200, 360), bg)));
fs.writeFileSync("pal.json", JSON.stringify(PAL.map((p) => p[0])));

// Qo'llanish: avatar, favicon, sayt sarlavhasi, vizitka, sertifikat
const avatar = (c) => { const f = T(P7, "F", 300), e = T(montM, "EDU", 46, 6); const fx = 256 - (f.w + 10 + e.w) / 2, fy = 256 - (f.top + f.bottom) / 2;
  return put(f, fx, fy, c.ink) + put(e, fx + f.w + 10, fy + f.top - e.top + 6, c.gold); };
fs.writeFileSync("app-avatar.svg", svg(512, 512, avatar(DARK), DARK.bg));
const fav = (() => { const f = T(P9, "F", 380); return put(f, 256 - f.w / 2, 256 - (f.top + f.bottom) / 2, DARK.ink) + `<circle cx="${256 + f.w / 2 + 6}" cy="${256 + (f.bottom - f.top) / 2 - 30}" r="30" fill="${DARK.gold}"/>`; })();
fs.writeFileSync("app-favicon.svg", svg(512, 512, fav, DARK.bg));
{ const d = mark({ dotI: true, size: 44, eduSize: 10, eduTr: 3 }, NAVY); const menu = ["Sertifikat", "Huquq sohalari", "Testlarim", "Reyting"];
  let mx = 520; const m = menu.map((t) => { const tt = T(montM, t, 16, 0.3); const out = put(tt, mx, 58, "#33415C"); mx += tt.w + 44; return out; }).join("");
  const btn = `<rect x="1120" y="30" width="140" height="44" rx="8" fill="${NAVY.ink}"/>` + put(T(montS, "Kirish", 16, 0.5), 1165, 58, "#FFFFFF");
  fs.writeFileSync("app-header.svg", svg(1300, 104, `<rect y="103" width="1300" height="1" fill="#E3E6EC"/><g transform="translate(40 ${52 - (d.bottom + d.top) / 2})">${d.body}</g>` + m + btn, "#FFFFFF")); }
{ const d = mark({ dotI: true, size: 64, eduSize: 13, eduTr: 3 }, DARK); const L = (t, y, f = montM, s = 15, c = DARK.ink) => put(T(f, t, s, 0.4), 48, y, c);
  fs.writeFileSync("app-card.svg", svg(700, 400, `<g transform="translate(48 ${110 - d.top - 40})">${d.body}</g><rect x="48" y="196" width="60" height="2" fill="${DARK.gold}"/>` +
    L("Ism Familiya", 250, montS, 22) + L("Asoschi", 280, montM, 15, DARK.gold) + L("femidaedu.uz  ·  @FemidaEduBot", 340, montM, 15), DARK.bg)); }
{ const d = mark({ dotI: true, size: 72, eduSize: 14, eduTr: 3 }, NAVY); const c = (t, y, f, s, col = NAVY.ink, tr = 1) => { const x = T(f, t, s, tr); return put(x, 500 - x.w / 2, y, col); };
  fs.writeFileSync("app-cert.svg", svg(1000, 700, `<rect x="24" y="24" width="952" height="652" fill="none" stroke="${NAVY.gold}" stroke-width="2"/><rect x="34" y="34" width="932" height="632" fill="none" stroke="${NAVY.gold}" stroke-width="0.8"/>` +
    `<g transform="translate(${500 - d.w / 2} ${130 - d.top - 40})">${d.body}</g>` + c("SERTIFIKAT", 270, SC, 40, NAVY.ink, 8) + c("MEHNAT HUQUQI", 330, tenor, 20, NAVY.gold, 6) +
    c("Ali Valiyev", 430, P6i, 56) + `<rect x="330" y="455" width="340" height="1.2" fill="${NAVY.gold}"/>` + c("nazoratli imtihonni 86% natija bilan topshirdi", 500, montM, 17, "#4B5B70", 0.3) +
    c("№ FE-2026-000142  ·  femidaedu.uz/c/000142", 610, montM, 13, "#8A93A3", 0.5), "#FFFFFF")); }
