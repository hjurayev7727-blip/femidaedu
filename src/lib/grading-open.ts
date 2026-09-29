// Qisqa yozma javobni tekshirish — v1 "savol-javob" sahifasidagi isRight() dan ko'chirilgan
// (05_TEXNIK_ONLAYN_TIZIM/deploy_savol_javob_3hafta/index.html), kirill kiritishni qo'llash qo'shilgan.
import { cyrillicToLatin } from "@/lib/translit";

/** n — son, m — modda raqami, s — matn */
export type OpenKind = "number" | "article" | "text";

const CYRILLIC = /[Ѐ-ӿ]/;
const toLatin = (s: string) => (CYRILLIC.test(s) ? cyrillicToLatin(s) : s);

export function norm(s: string): string {
  return toLatin(String(s || ""))
    .toLowerCase()
    .replace(/[‘’ʻʼ`´']/g, "")
    .replace(/[«»"“”„]/g, " ")
    .replace(/[^a-z0-9.,/ ]+/g, " ")
    .replace(/(\d)[.,](\d)/g, "$1#$2")
    .replace(/[.,/]/g, " ")
    .replace(/#/g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

const W1: Record<string, number> = { bir: 1, ikki: 2, uch: 3, tort: 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, toqqiz: 9 };
const W10: Record<string, number> = {
  on: 10, yigirma: 20, ottiz: 30, qirq: 40, ellik: 50, oltmish: 60, yetmish: 70, sakson: 80, toqson: 90,
};
const SUF = ["inchi", "nchi", "tadan", "tasi", "ta", "dan", "ga", "da", "ni", "yil", "kun"];

function wordNum(w: string): string | null {
  const isNum = (x: string) => W1[x] != null || W10[x] != null || x === "yuz" || x === "ming";
  if (isNum(w)) return w;
  for (const s of SUF) {
    if (w.length > s.length && w.endsWith(s)) {
      const b = w.slice(0, -s.length);
      if (isNum(b)) return b;
    }
  }
  return null;
}

/** Matndagi barcha sonlarni ajratadi: "100 000", "220 ming", "yigirma besh", "90,21" */
export function numbers(raw: string): number[] {
  let s = toLatin(String(raw || "")).toLowerCase().replace(/[‘’ʻʼ`´']/g, "");
  s = s.replace(/(\d{1,3})(?:[  ](\d{3}))+(?!\d)/g, (m) => m.replace(/[  ]/g, ""));
  s = s.replace(/(\d),(\d)/g, "$1.$2");
  const toks = s.match(/\d+(?:\.\d+)?|[a-z]+/g) || [];
  const out: number[] = [];
  let cur: number | null = null;
  let tot = 0;
  let inW = false;
  let lastDigit: number | null = null;
  const flushW = () => {
    if (inW) out.push(tot + (cur || 0));
    inW = false;
    cur = null;
    tot = 0;
  };
  for (const t of toks) {
    if (/^\d/.test(t)) {
      flushW();
      lastDigit = parseFloat(t);
      out.push(lastDigit);
      continue;
    }
    if (wordNum(t) === "ming" && lastDigit != null && !inW) {
      out[out.length - 1] = lastDigit * 1000;
      lastDigit = null;
      continue;
    }
    const w = wordNum(t);
    if (w == null) {
      flushW();
      lastDigit = null;
      continue;
    }
    lastDigit = null;
    inW = true;
    if (W1[w] != null) cur = (cur || 0) + W1[w];
    else if (W10[w] != null) cur = (cur || 0) + W10[w];
    else if (w === "yuz") cur = (cur || 1) * 100;
    else if (w === "ming") {
      tot += (cur || 1) * 1000;
      cur = 0;
    }
  }
  flushW();
  return out;
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let p = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const c = [i];
    for (let j = 1; j <= b.length; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[b.length];
}

const FILL = ["bilan", "asosida", "orqali", "tomonidan", "boshlab", "hisoblanadi", "deyiladi", "ataladi", "bu", "deb"];
function stripFill(s: string): string {
  const w = s.split(" ");
  while (w.length > 1 && FILL.includes(w[w.length - 1])) w.pop();
  return w.join(" ");
}

export function isOpenAnswerRight(answer: { accepted: string[]; show: string }, raw: string, kind: OpenKind): boolean {
  if (!String(raw || "").trim()) return false;
  if (kind === "number" || kind === "article") {
    const want = parseFloat(answer.accepted[0]);
    const got = numbers(raw);
    if (!got.length) return false;
    const uniq = [...new Set(got.map((x) => Math.round(x * 1000) / 1000))];
    return uniq.length === 1 && Math.abs(uniq[0] - want) < 1e-9;
  }
  const inp = stripFill(norm(raw));
  for (const v0 of [...answer.accepted, answer.show, answer.show.replace(/\(.*?\)/g, "")]) {
    const v = norm(v0);
    if (!v) continue;
    if (inp === v) return true;
    if (inp.startsWith(v)) {
      const rest = inp.slice(v.length);
      if (rest.length <= 6 && !rest.includes(" ")) return true;
    }
    if (v.length >= 5 && lev(inp, v) <= 1) return true;
    if (v.length >= 9 && lev(inp, v) <= 2) return true;
  }
  return false;
}
