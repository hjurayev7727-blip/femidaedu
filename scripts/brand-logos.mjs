// Femida Edu logo variantlari (A–F): matnni opentype.js bilan vektor yo'lga aylantiradi.
// Ishga tushirish: alohida papkada `npm i opentype.js @fontsource/cinzel @fontsource/cormorant-garamond @fontsource/montserrat`, keyin `node brand-logos.mjs`.
import opentype from "opentype.js";
import fs from "node:fs";
const F = (p) => { const b = fs.readFileSync(new URL(`./node_modules/@fontsource/${p}`, import.meta.url)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const cinzel = F("cinzel/files/cinzel-latin-600-normal.woff");
const corm = F("cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff");
const mont = F("montserrat/files/montserrat-latin-600-normal.woff");
const montM = F("montserrat/files/montserrat-latin-500-normal.woff");
const NAVY = "#0E2340", GOLD = "#B8923A";

const n = (v) => Math.round(v * 100) / 100;
// opentype toPathData ba'zi glyphlarda NaN beradi — buyruqlardan o'zimiz yig'amiz
const pathData = (p) => p.commands.map((c) => c.type === "M" || c.type === "L" ? `${c.type}${n(c.x)} ${n(c.y)}` :
  c.type === "Q" ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === "C" ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : "Z").join("");
// matnni vektor yo'lga aylantirish (harflar orasidagi masofa bilan)
function text(font, str, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  let x = 0; const parts = []; let minY = Infinity, maxY = -Infinity;
  for (const g of font.stringToGlyphs(str)) {
    const p = g.getPath(x, 0, size); const bb = p.getBoundingBox();
    if (isFinite(bb.y1)) { minY = Math.min(minY, bb.y1); maxY = Math.max(maxY, bb.y2); }
    parts.push(pathData(p)); x += (g.advanceWidth ?? font.hmtx?.[g.index]?.advanceWidth ?? font.getAdvanceWidth(String.fromCodePoint(g.unicode), font.unitsPerEm)) * scale + tracking;
  }
  return { d: parts.join(""), width: x - tracking, top: minY, bottom: maxY };
}
const put = (t, x, y, fill) => `<path transform="translate(${x.toFixed(1)} ${y.toFixed(1)})" fill="${fill}" d="${t.d}"/>`;
const svg = (w, h, body, bg = "#fff") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;

// ── A. Muhr: ikki doira + Cinzel F; so'z: FEMIDA (Cinzel) / chiziq / EDU (Montserrat)
function markA(cx, cy, r, ink = NAVY, gold = GOLD) {
  const f = text(cinzel, "F", r * 1.25);
  const fx = cx - f.width / 2, fy = cy - (f.top + f.bottom) / 2;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${gold}" stroke-width="${r * 0.035}"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.88}" fill="none" stroke="${gold}" stroke-width="${r * 0.012}"/>` + put(f, fx, fy, ink);
}
{
  const w1 = text(cinzel, "FEMIDA", 104, 18), w2 = text(montM, "EDU", 26, 22);
  const x = 330, y = 190;
  const body = markA(170, 180, 120) + put(w1, x, y, NAVY) +
    `<rect x="${x}" y="${y + 24}" width="${w1.width}" height="2" fill="${GOLD}"/>` +
    put(w2, x + (w1.width - w2.width) / 2, y + 70, GOLD);
  fs.writeFileSync("A-logo.svg", svg(1200, 360, body));
  fs.writeFileSync("A-mark.svg", svg(512, 512, markA(256, 256, 190, "#F4EFE3", "#C9A24A"), NAVY));
}

// ── B. Tarozi: nafis chiziqli tarozi; so'z: Femida (Cormorant) + EDU (Montserrat)
function scales(cx, top, s, c) {
  const sw = 5 * s, thin = 1.6 * s, beamY = top + 34 * s, half = 78 * s, drop = 70 * s, pw = 30 * s;
  const pan = (x) => `<path d="M${x} ${beamY}L${x - pw} ${beamY + drop}M${x} ${beamY}L${x + pw} ${beamY + drop}" stroke="${c}" stroke-width="${thin}" fill="none"/>` +
    `<path d="M${x - pw - 6 * s} ${beamY + drop}Q${x} ${beamY + drop + 30 * s} ${x + pw + 6 * s} ${beamY + drop}Z" fill="${c}"/>`;
  return `<circle cx="${cx}" cy="${top}" r="${7 * s}" fill="${c}"/>` +
    `<path d="M${cx} ${top + 8 * s}V${top + 190 * s}" stroke="${c}" stroke-width="${sw}"/>` +
    `<path d="M${cx - half} ${beamY}H${cx + half}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
    pan(cx - half) + pan(cx + half) +
    `<path d="M${cx - 44 * s} ${top + 200 * s}H${cx + 44 * s}L${cx + 30 * s} ${top + 188 * s}H${cx - 30 * s}Z" fill="${c}"/>`;
}
{
  const w1 = text(corm, "Femida", 132), w2 = text(mont, "EDU", 30, 12);
  const x = 300, y = 222;
  const body = `<circle cx="160" cy="180" r="128" fill="${NAVY}"/>` + scales(160, 82, 0.95, "#D9B45A") +
    put(w1, x, y, NAVY) + put(w2, x + w1.width + 18, y, GOLD);
  fs.writeFileSync("B-logo.svg", svg(1200, 360, body));
  fs.writeFileSync("B-mark.svg", svg(512, 512, scales(256, 120, 1.45, "#D9B45A"), NAVY));
}

// ── C. Zamonaviy: geometrik F (oq), o'rta chiziq oltin; so'z: FEMIDA EDU (Montserrat)
function markC(x, y, s, bg = NAVY) {
  const r = (a, b, w, h, c) => `<rect x="${x + a * s}" y="${y + b * s}" width="${w * s}" height="${h * s}" fill="${c}"/>`;
  return r(0, 0, 240, 240, bg) + r(66, 50, 30, 140, "#fff") + r(66, 50, 110, 30, "#fff") + r(106, 104, 60, 26, GOLD);
}
{
  const w1 = text(mont, "FEMIDA", 92, 10), w2 = text(mont, "EDU", 92, 10);
  const x = 330, y = 214;
  const body = markC(60, 60, 1) + put(w1, x, y, NAVY) + put(w2, x + w1.width + 34, y, GOLD);
  fs.writeFileSync("C-logo.svg", svg(1200, 360, body));
  fs.writeFileSync("C-mark.svg", svg(480, 480, markC(0, 0, 2), NAVY));
}

// ── Qo'shimcha: aralash variantlar + to'q fon versiyalari
const IVORY = "#F4EFE3", GOLD2 = "#C9A24A";
function wordA(x, y, ink, gold) {
  const w1 = text(cinzel, "FEMIDA", 104, 18), w2 = text(montM, "EDU", 26, 22);
  return put(w1, x, y, ink) + `<rect x="${x}" y="${y + 24}" width="${w1.width}" height="2" fill="${gold}"/>` + put(w2, x + (w1.width - w2.width) / 2, y + 70, gold);
}
function wordB(x, y, ink, gold) {
  const w1 = text(corm, "Femida", 132), w2 = text(mont, "EDU", 30, 12);
  return put(w1, x, y, ink) + put(w2, x + w1.width + 18, y, gold);
}
function wordC(x, y, ink, gold) {
  const w1 = text(mont, "FEMIDA", 92, 10), w2 = text(mont, "EDU", 92, 10);
  return put(w1, x, y, ink) + put(w2, x + w1.width + 34, y, gold);
}
function shield(cx, cy, s, stroke, ink) {
  const f = text(cinzel, "F", 150 * s);
  const d = `M${cx - 95 * s} ${cy - 110 * s}H${cx + 95 * s}V${cy - 10 * s}Q${cx + 95 * s} ${cy + 80 * s} ${cx} ${cy + 125 * s}Q${cx - 95 * s} ${cy + 80 * s} ${cx - 95 * s} ${cy - 10 * s}Z`;
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${5 * s}"/>` + put(f, cx - f.width / 2, cy - (f.top + f.bottom) / 2 - 8 * s, ink);
}
const V = {
  A: { mark: (d) => markA(170, 180, 120, d ? IVORY : NAVY, d ? GOLD2 : GOLD), word: wordA, x: 330, y: 190, icon: () => markA(256, 256, 190, IVORY, GOLD2) },
  B: { mark: () => `<circle cx="160" cy="180" r="128" fill="${NAVY}" stroke="#D9B45A" stroke-width="3"/>` + scales(160, 82, 0.95, "#D9B45A"), word: wordB, x: 300, y: 222, icon: () => scales(256, 120, 1.45, "#D9B45A") },
  C: { mark: () => markC(60, 60, 1), word: wordC, x: 330, y: 214, icon: () => markC(16, 16, 2) },
  D: { mark: () => markC(60, 60, 1), word: wordA, x: 330, y: 190, icon: () => markC(16, 16, 2) },
  E: { mark: () => `<rect x="40" y="52" width="256" height="256" rx="36" fill="${NAVY}"/>` + scales(168, 96, 0.9, "#D9B45A"), word: wordA, x: 330, y: 190, icon: () => scales(256, 120, 1.45, "#D9B45A") },
  F: { mark: (d) => shield(165, 182, 1.15, d ? GOLD2 : GOLD, d ? IVORY : NAVY), word: wordB, x: 310, y: 222, icon: () => shield(256, 262, 1.6, GOLD2, IVORY) },
};
for (const [k, v] of Object.entries(V)) {
  fs.writeFileSync(`${k}-logo.svg`, svg(1200, 360, v.mark(false) + v.word(v.x, v.y, NAVY, GOLD)));
  fs.writeFileSync(`${k}-logo-dark.svg`, svg(1200, 360, v.mark(true) + v.word(v.x, v.y, IVORY, GOLD2), NAVY));
  fs.writeFileSync(`${k}-mark.svg`, svg(512, 512, v.icon(), NAVY));
}
