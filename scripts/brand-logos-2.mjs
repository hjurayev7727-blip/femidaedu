// Femida Edu logo variantlari, 2-to'plam (G–N). O'rnatish: brand-logos.mjs dagi paketlar + @fontsource/{bodoni-moda,playfair-display,marcellus,space-grotesk,unbounded,great-vibes,raleway,prata,josefin-sans}
// Femida Edu — 2-to'plam: 8 xil uslub (G–N). Matn vektor yo'lga aylantiriladi.
import opentype from "opentype.js";
import fs from "node:fs";
const F = (p, w) => { const b = fs.readFileSync(new URL(`./node_modules/@fontsource/${p}/files/${p}-latin-${w}-normal.woff`, import.meta.url)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const n = (v) => Math.round(v * 100) / 100;
const pd = (p) => p.commands.map((c) => c.type === "M" || c.type === "L" ? `${c.type}${n(c.x)} ${n(c.y)}` : c.type === "Q" ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}` : c.type === "C" ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : "Z").join("");
function T(font, str, size, tr = 0) {
  const sc = size / font.unitsPerEm; let x = 0; const parts = []; let t = Infinity, b = -Infinity; const xs = [];
  for (const g of [...str].map((ch) => font.charToGlyph(ch))) { const p = g.getPath(x, 0, size); const bb = p.getBoundingBox(); if (isFinite(bb.y1)) { t = Math.min(t, bb.y1); b = Math.max(b, bb.y2); } parts.push(pd(p)); xs.push([x, g.advanceWidth * sc]); x += g.advanceWidth * sc + tr; }
  return { d: parts.join(""), w: x - tr, top: t, bottom: b, xs };
}
const put = (t, x, y, fill) => `<path transform="translate(${n(x)} ${n(y)})" fill="${fill}" d="${t.d}"/>`;
const svg = (w, h, body, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${body}</svg>\n`;
const center = (t, cx, cy, fill) => put(t, cx - t.w / 2, cy - (t.top + t.bottom) / 2, fill);

const bodoni = F("bodoni-moda", 600), bodoni7 = F("bodoni-moda", 700), playfair = F("playfair-display", 700), playfair6 = F("playfair-display", 500),
  marcellus = F("marcellus", 400), grotesk = F("space-grotesk", 600), grotesk3 = F("space-grotesk", 400), unb = F("unbounded", 700),
  vibes = F("great-vibes", 400), raleway = F("raleway", 600), prata = F("prata", 400), josefin = F("josefin-sans", 600);

const V = {};

// G — Paragraf belgisi (§): huquq ramzi. Bordo + qaymoq.
{
  const C = { ink: "#6B1E2E", gold: "#B08A3E", bg: "#FBF7F0" };
  const mark = (cx, cy, r, ring, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ring}"/>` + center(T(bodoni7, "§", r * 1.5), cx, cy, fill);
  const w1 = T(bodoni, "Femida", 128), w2 = T(raleway, "EDU", 28, 14);
  V.G = { name: "G — Paragraf (§)", bg: C.bg, logo: mark(170, 180, 118, C.ink, "#F3E6CF") + put(w1, 320, 222, C.ink) + put(w2, 326 + w1.w - w2.w, 268, C.gold),
    dark: [C.ink, mark(170, 180, 118, "#F3E6CF", C.ink) + put(w1, 320, 222, "#F3E6CF") + put(w2, 326 + w1.w - w2.w, 268, "#D8B46A")],
    icon: [C.ink, center(T(bodoni7, "§", 330), 256, 256, "#F3E6CF")] };
}

// H — Ustun: FEMIDA so'zidagi "I" o'rnida antik ustun. Qora + oltin.
{
  const C = { ink: "#141414", gold: "#B9973F", bg: "#FFFFFF" };
  const column = (x, base, h, c) => { const w = h * 0.34; return `<rect x="${x - w * 0.75}" y="${base - h * 0.06}" width="${w * 1.5}" height="${h * 0.06}" fill="${c}"/>` +
    `<rect x="${x - w * 0.6}" y="${base - h * 0.1}" width="${w * 1.2}" height="${h * 0.035}" fill="${c}"/>` +
    [-0.3, 0, 0.3].map((k) => `<rect x="${x + k * w - w * 0.09}" y="${base - h * 0.86}" width="${w * 0.18}" height="${h * 0.74}" fill="${c}"/>`).join("") +
    `<rect x="${x - w * 0.62}" y="${base - h * 0.92}" width="${w * 1.24}" height="${h * 0.05}" fill="${c}"/>` +
    `<circle cx="${x - w * 0.62}" cy="${base - h * 0.93}" r="${h * 0.055}" fill="none" stroke="${c}" stroke-width="${h * 0.028}"/>` +
    `<circle cx="${x + w * 0.62}" cy="${base - h * 0.93}" r="${h * 0.055}" fill="none" stroke="${c}" stroke-width="${h * 0.028}"/>` +
    `<rect x="${x - w * 0.8}" y="${base - h}" width="${w * 1.6}" height="${h * 0.04}" fill="${c}"/>`; };
  const word = (ink, gold) => { const a = T(marcellus, "FEM", 120, 16), b = T(marcellus, "DA", 120, 16); const capH = -a.top; const x0 = 90, y = 210;
    const gap = 84; const colX = x0 + a.w + 16 + gap / 2; const e = T(raleway, "E D U", 26, 10);
    return put(a, x0, y, ink) + column(colX, y, capH, gold) + put(b, x0 + a.w + 16 + gap + 16, y, ink) + put(e, x0 + (a.w + gap + b.w + 48) / 2 - e.w / 2, y + 60, gold); };
  V.H = { name: "H — Ustun (antik)", bg: C.bg, logo: word(C.ink, C.gold), dark: [C.ink, word("#F2EEE6", "#D6B35A")], icon: [C.ink, column(256, 400, 290, "#D6B35A")] };
}

// I — Muvozanat: ikki teng chiziq + tayanch uchburchak. Minimal, texnologik. Zumrad.
{
  const C = { ink: "#0B4F43", acc: "#3FC1A0", bg: "#FFFFFF" };
  const mark = (x, y, s, c1, c2) => `<rect x="${x}" y="${y}" width="${150 * s}" height="${22 * s}" rx="${11 * s}" fill="${c1}"/>` +
    `<rect x="${x}" y="${y + 44 * s}" width="${150 * s}" height="${22 * s}" rx="${11 * s}" fill="${c1}"/>` +
    `<path d="M${x + 75 * s} ${y + 86 * s}L${x + 110 * s} ${y + 146 * s}H${x + 40 * s}Z" fill="${c2}"/>`;
  const w1 = T(grotesk, "femida", 118, -2), w2 = T(grotesk3, "edu", 118, -2);
  V.I = { name: "I — Muvozanat (minimal)", bg: C.bg, logo: mark(70, 108, 1, C.ink, C.acc) + put(w1, 270, 214, C.ink) + put(w2, 280 + w1.w, 214, C.acc),
    dark: [C.ink, mark(70, 108, 1, "#FFFFFF", C.acc) + put(w1, 270, 214, "#FFFFFF") + put(w2, 280 + w1.w, 214, C.acc)], icon: [C.ink, mark(141, 146, 1.53, "#FFFFFF", C.acc)] };
}

// J — Ko'zi bog'liq adolat: bosh (doira) va ko'z bog'ichi (lenta). Siyohrang + oltin.
{
  const C = { ink: "#2E1A47", gold: "#C9A45C", bg: "#FFFFFF" };
  const mark = (cx, cy, r, head, band) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${head}"/>` +
    `<path d="M${cx - r * 1.05} ${cy - r * 0.32}H${cx + r * 1.05}V${cy - r * 0.02}H${cx - r * 1.05}Z" fill="${band}"/>` +
    `<path d="M${cx + r * 0.95} ${cy - r * 0.02}Q${cx + r * 1.35} ${cy + r * 0.3} ${cx + r * 1.2} ${cy + r * 0.75}L${cx + r * 1.02} ${cy + r * 0.62}Q${cx + r * 1.12} ${cy + r * 0.3} ${cx + r * 0.8} ${cy - r * 0.02}Z" fill="${band}"/>`;
  const w1 = T(prata, "FEMIDA", 110, 10), w2 = T(raleway, "EDU", 30, 16);
  V.J = { name: "J — Ko'zi bog'liq adolat", bg: C.bg, logo: mark(150, 180, 88, C.ink, C.gold) + put(w1, 300, 200, C.ink) + put(w2, 304, 256, C.gold),
    dark: [C.ink, mark(150, 180, 88, "#EDE6F5", C.gold) + put(w1, 300, 200, "#EDE6F5") + put(w2, 304, 256, C.gold)], icon: [C.ink, mark(236, 256, 140, "#EDE6F5", C.gold)] };
}

// K — Kitob va tarozi: ochiq kitob, o'rtasidan tarozi o'sib chiqadi. Qirollik ko'k + amber.
{
  const C = { ink: "#1C3D7A", acc: "#E0A526", bg: "#FFFFFF" };
  const mark = (cx, by, s, c1, c2) => `<path d="M${cx} ${by}Q${cx - 60 * s} ${by - 26 * s} ${cx - 120 * s} ${by - 6 * s}V${by - 86 * s}Q${cx - 60 * s} ${by - 106 * s} ${cx} ${by - 80 * s}Z" fill="${c1}"/>` +
    `<path d="M${cx} ${by}Q${cx + 60 * s} ${by - 26 * s} ${cx + 120 * s} ${by - 6 * s}V${by - 86 * s}Q${cx + 60 * s} ${by - 106 * s} ${cx} ${by - 80 * s}Z" fill="${c1}" opacity=".82"/>` +
    `<path d="M${cx} ${by - 84 * s}V${by - 190 * s}M${cx - 70 * s} ${by - 172 * s}H${cx + 70 * s}" stroke="${c2}" stroke-width="${7 * s}" stroke-linecap="round"/>` +
    [-70, 70].map((d) => `<path d="M${cx + d * s} ${by - 172 * s}L${cx + (d - 22) * s} ${by - 124 * s}M${cx + d * s} ${by - 172 * s}L${cx + (d + 22) * s} ${by - 124 * s}" stroke="${c2}" stroke-width="${2.5 * s}"/><path d="M${cx + (d - 28) * s} ${by - 124 * s}Q${cx + d * s} ${by - 100 * s} ${cx + (d + 28) * s} ${by - 124 * s}Z" fill="${c2}"/>`).join("") +
    `<circle cx="${cx}" cy="${by - 196 * s}" r="${7 * s}" fill="${c2}"/>`;
  const w1 = T(josefin, "FEMIDA EDU", 84, 8);
  V.K = { name: "K — Kitob + tarozi", bg: C.bg, logo: mark(160, 280, 1, C.ink, C.acc) + put(w1, 320, 212, C.ink),
    dark: [C.ink, mark(160, 280, 1, "#FFFFFF", C.acc) + put(w1, 320, 212, "#FFFFFF")], icon: [C.ink, mark(256, 400, 1.45, "#FFFFFF", C.acc)] };
}

// L — Imzo: qo'lyozma "Femida" + nafis chiziq. Qora + oltin, qaymoq fon.
{
  const C = { ink: "#1A1A1A", gold: "#A8823A", bg: "#FAF6EE" };
  const w1 = T(vibes, "Femida", 190), w2 = T(raleway, "E D U", 26, 12);
  const body = (ink, gold) => put(w1, 110, 220, ink) + `<path d="M130 250Q${130 + w1.w / 2} 236 ${120 + w1.w} 246" fill="none" stroke="${gold}" stroke-width="3" stroke-linecap="round"/>` + put(w2, 130 + w1.w - w2.w, 292, gold);
  V.L = { name: "L — Imzo (qo'lyozma)", bg: C.bg, logo: body(C.ink, C.gold), dark: [C.ink, body("#F5EFE2", "#D2AE62")], icon: [C.ink, center(T(vibes, "F", 380), 256, 262, "#E3C27A")] };
}

// M — Edtech: qalin zamonaviy shrift, "i" nuqtasi — oltin romb. Indigo + laym.
{
  const C = { ink: "#2B21B8", acc: "#C8F03C", bg: "#FFFFFF" };
  const word = (ink, acc, x, y, size) => { const w = T(unb, "femıda", size, -2); const ix = w.xs[3]; const d = size * 0.13;
    const cx = x + ix[0] + ix[1] / 2, cy = y + w.top - d * 0.2; return put(w, x, y, ink) + `<path d="M${cx} ${cy - d}L${cx + d} ${cy}L${cx} ${cy + d}L${cx - d} ${cy}Z" fill="${acc}"/>`; };
  const e = T(unb, "edu", 40, 2);
  V.M = { name: "M — Zamonaviy edtech", bg: C.bg, logo: word(C.ink, C.acc === "#C8F03C" ? "#9BC91C" : C.acc, 90, 220, 124) + put(e, 96, 280, "#9BC91C"),
    dark: [C.ink, word("#FFFFFF", C.acc, 90, 220, 124) + put(e, 96, 280, C.acc)], icon: [C.ink, center(T(unb, "f", 300), 256, 250, "#FFFFFF") + `<path d="M330 150l26 26-26 26-26-26z" fill="${C.acc}"/>`] };
}

// N — FE monogramma: F va E bir-biriga kirgan, ramkada. Qora + oltin.
{
  const C = { ink: "#101820", gold: "#BF9B4B", bg: "#FFFFFF" };
  const mono = (cx, cy, s, c1, c2, frame) => { const f = T(playfair, "F", 170 * s), e = T(playfair, "E", 170 * s);
    return `<rect x="${cx - 105 * s}" y="${cy - 105 * s}" width="${210 * s}" height="${210 * s}" fill="none" stroke="${frame}" stroke-width="${3 * s}"/>` +
      put(f, cx - f.w * 0.98, cy - (f.top + f.bottom) / 2 - 14 * s, c1) + put(e, cx - e.w * 0.08, cy - (e.top + e.bottom) / 2 + 22 * s, c2); };
  const w1 = T(playfair6, "Femida Edu", 104, 1);
  V.N = { name: "N — FE monogramma", bg: C.bg, logo: mono(165, 180, 1, C.ink, C.gold, C.gold) + put(w1, 320, 214, C.ink),
    dark: [C.ink, mono(165, 180, 1, "#F4F1EA", C.gold, C.gold) + put(w1, 320, 214, "#F4F1EA")], icon: [C.ink, mono(256, 256, 1.7, "#F4F1EA", C.gold, C.gold)] };
}

for (const [k, v] of Object.entries(V)) {
  fs.writeFileSync(`${k}-logo.svg`, svg(1200, 360, v.logo, v.bg));
  fs.writeFileSync(`${k}-logo-dark.svg`, svg(1200, 360, v.dark[1], v.dark[0]));
  fs.writeFileSync(`${k}-mark.svg`, svg(512, 512, v.icon[1], v.icon[0]));
}
fs.writeFileSync("names2.json", JSON.stringify(Object.fromEntries(Object.entries(V).map(([k, v]) => [k, v.name]))));
