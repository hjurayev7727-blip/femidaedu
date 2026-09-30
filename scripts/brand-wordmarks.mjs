// Femida Edu — faqat matnli logolar (W1–W10). O'rnatish: brand-logos.mjs va brand-logos-2.mjs dagi paketlar + @fontsource/{eb-garamond,libre-caslon-text,tenor-sans}
// Femida Edu — faqat matnli logolar (W1–W10). Rang hammasida bir xil: farqni tipografiya beradi.
import opentype from "opentype.js";
import fs from "node:fs";
const F = (p, w, st = "normal") => { const b = fs.readFileSync(new URL(`./node_modules/@fontsource/${p}/files/${p}-latin-${w}-${st}.woff`, import.meta.url)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const n = (v) => Math.round(v * 100) / 100;
const pd = (p) => p.commands.map((c) => c.type === "M" || c.type === "L" ? `${c.type}${n(c.x)} ${n(c.y)}` : c.type === "Q" ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === "C" ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : "Z").join("");
// har harf alohida yo'l — bitta harfni boshqa rangga bo'yash uchun
function T(font, str, size, tr = 0) {
  const sc = size / font.unitsPerEm; let x = 0; const g = []; let t = Infinity, b = -Infinity;
  for (const ch of str) { const gl = font.charToGlyph(ch); const p = gl.getPath(x, 0, size); const bb = p.getBoundingBox(); if (isFinite(bb.y1)) { t = Math.min(t, bb.y1); b = Math.max(b, bb.y2); } g.push(pd(p)); x += gl.advanceWidth * sc + tr; }
  return { g, w: x - tr, top: t, bottom: b };
}
const put = (t, x, y, fill, colors = {}) => t.g.map((d, i) => `<path transform="translate(${n(x)} ${n(y)})" fill="${colors[i] ?? fill}" d="${d}"/>`).join("");
const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;
const LIGHT = { bg: "#FFFFFF", ink: "#0E2340", gold: "#B08A3A" }, DARK = { bg: "#0E2340", ink: "#F4EFE3", gold: "#CFAB5E" };

const cinzel = F("cinzel", 600), cinzel5 = F("cinzel", 500), bodoni = F("bodoni-moda", 600), garaI = F("eb-garamond", 500, "italic"), gara = F("eb-garamond", 500),
  tenor = F("tenor-sans", 400), caslonI = F("libre-caslon-text", 400, "italic"), grotesk = F("space-grotesk", 600), grotesk3 = F("space-grotesk", 400),
  ral8 = F("raleway", 800), ral2 = F("raleway", 200), playfair = F("playfair-display", 700), marcellus = F("marcellus", 400), montM = F("montserrat", 500);

// Har variant: draw(c) → {body, w, h} (0,0 dan boshlanadi, baseline y=0), avatar(c) → 512x512 ichida
const W = [];
const add = (key, name, draw, avatar) => W.push({ key, name, draw, avatar });
const avatarText = (font, str, size, c, colors = {}, tr = 0) => { const t = T(font, str, size, tr); return put(t, 256 - t.w / 2, 256 - (t.top + t.bottom) / 2, c.ink, colors); };

add("W1", "W1 — Rim yozuvi (Cinzel) + EDU chiziqdan keyin", (c) => {
  const a = T(cinzel, "FEMIDA", 118, 20), e = T(montM, "EDU", 38, 12);
  return { body: put(a, 0, 0, c.ink) + `<rect x="${a.w + 30}" y="${a.top}" width="2.5" height="${-a.top}" fill="${c.gold}"/>` + put(e, a.w + 62, -((-a.top) - (-e.top)) / 2, c.gold), w: a.w + 62 + e.w, top: a.top, bottom: 0 };
}, (c) => avatarText(cinzel, "F", 300, c));

add("W2", "W2 — Oltin \"I\" (Marcellus): ustun kabi o'rtadagi harf", (c) => {
  const a = T(marcellus, "FEMIDA", 132, 18), e = T(montM, "E D U", 26, 8);
  return { body: put(a, 0, 0, c.ink, { 3: c.gold }) + put(e, a.w / 2 - e.w / 2, 58, c.gold), w: a.w, top: a.top, bottom: 58 };
}, (c) => avatarText(marcellus, "FI", 260, c, { 1: c.gold }, 10));

add("W3", "W3 — Yuqori kontrast (Bodoni) + kursiv edu", (c) => {
  const a = T(bodoni, "Femida", 160), e = T(garaI, "edu", 92);
  return { body: put(a, 0, 0, c.ink) + put(e, a.w + 22, 0, c.gold), w: a.w + 22 + e.w, top: a.top, bottom: a.bottom };
}, (c) => avatarText(bodoni, "F", 330, c));

add("W4", "W4 — Garamond + oltin nuqta", (c) => {
  const a = T(gara, "Femida", 168), dot = 15, e = T(tenor, "EDU", 30, 10);
  const dx = a.w + 12 + dot;
  return { body: put(a, 0, 0, c.ink) + `<circle cx="${dx}" cy="${-dot}" r="${dot}" fill="${c.gold}"/>` + put(e, dx + dot + 16, 0, c.ink), w: dx + dot + 16 + e.w, top: a.top, bottom: a.bottom };
}, (c) => { const t = T(gara, "F", 340); return put(t, 236 - t.w / 2, 256 - (t.top + t.bottom) / 2, c.ink) + `<circle cx="${236 + t.w / 2 + 28}" cy="${256 + (t.bottom - t.top) / 2 - 22}" r="22" fill="${c.gold}"/>`; });

add("W5", "W5 — Ikki qavat: FEMIDA / —— EDU ——", (c) => {
  const a = T(cinzel, "FEMIDA", 112, 24), e = T(cinzel5, "EDU", 30, 18); const y2 = 62, lw = (a.w - e.w) / 2 - 26;
  return { body: put(a, 0, 0, c.ink) + `<rect x="0" y="${y2 - 11}" width="${lw}" height="1.8" fill="${c.gold}"/><rect x="${a.w - lw}" y="${y2 - 11}" width="${lw}" height="1.8" fill="${c.gold}"/>` + put(e, a.w / 2 - e.w / 2, y2, c.gold), w: a.w, top: a.top, bottom: y2 };
}, (c) => avatarText(cinzel, "FE", 230, c, { 1: c.gold }, 6));

add("W6", "W6 — Kursiv Caslon (nafis, kitobiy)", (c) => {
  const a = T(caslonI, "Femida", 150), e = T(tenor, "EDU", 30, 14);
  return { body: put(a, 0, 0, c.ink) + put(e, a.w - e.w - 6, 50, c.gold), w: a.w, top: a.top, bottom: 50 };
}, (c) => avatarText(caslonI, "F", 330, c));

add("W7", "W7 — Zamonaviy grotesk: femida/edu", (c) => {
  const a = T(grotesk, "femida", 140, -3), s = T(grotesk3, "/edu", 140, -3);
  return { body: put(a, 0, 0, c.ink) + put(s, a.w + 4, 0, c.gold), w: a.w + 4 + s.w, top: Math.min(a.top, s.top), bottom: Math.max(a.bottom, s.bottom) };
}, (c) => avatarText(grotesk, "f/", 300, c, { 1: c.gold }, -6));

add("W8", "W8 — Keng harflar (Tenor Sans), minimal hashamat", (c) => {
  const a = T(tenor, "FEMIDA", 92, 34), e = T(tenor, "EDU", 92, 34);
  return { body: put(a, 0, 0, c.ink) + put(e, a.w + 60, 0, c.gold), w: a.w + 60 + e.w, top: a.top, bottom: 0 };
}, (c) => avatarText(tenor, "FE", 220, c, { 1: c.gold }, 14));

add("W9", "W9 — Og'irlik kontrasti: FEMIDA qalin / EDU ingichka", (c) => {
  const a = T(ral8, "FEMIDA", 118, 4), e = T(ral2, "EDU", 118, 4);
  return { body: put(a, 0, 0, c.ink) + put(e, a.w + 26, 0, c.gold), w: a.w + 26 + e.w, top: a.top, bottom: 0 };
}, (c) => avatarText(ral8, "F", 320, c));

add("W10", "W10 — Playfair + EDU belgi o'rnida (yuqori o'ngda)", (c) => {
  const a = T(playfair, "Femida", 164), e = T(montM, "EDU", 30, 8);
  return { body: put(a, 0, 0, c.ink) + put(e, a.w + 14, a.top - e.top + 4, c.gold), w: a.w + 14 + e.w, top: a.top, bottom: a.bottom };
}, (c) => avatarText(playfair, "F", 330, c));

for (const v of W) for (const [suffix, c] of [["", LIGHT], ["-dark", DARK]]) {
  const d = v.draw(c); const h = d.bottom - d.top; const x = (1200 - d.w) / 2, y = (360 - h) / 2 - d.top;
  fs.writeFileSync(`${v.key}${suffix}.svg`, svg(1200, 360, `<g transform="translate(${n(x)} ${n(y)})">${d.body}</g>`, c.bg));
  if (!suffix) fs.writeFileSync(`${v.key}-mark.svg`, svg(512, 512, v.avatar(DARK), DARK.bg));
}
fs.writeFileSync("names3.json", JSON.stringify(Object.fromEntries(W.map((v) => [v.key, v.name]))));
