// v1 (HUQUQSHUNOSLIK KURSI) dagi barcha savol manbalarini o'qiydi.
// Har bir element "RawItem" ga aylanadi: asl v1 obyekti + qaysi hujjat/darslikka tegishli ekani.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { basename, join } from "node:path";
import { resolveDocument } from "./documents";

/** v1 formatidagi savol (09_DARS_MATERIALLARI/_generator/*.json) */
export type V1Item = {
  type: "mc" | "fb" | "keys" | "dd" | "ord";
  d?: number;
  q?: string;
  src?: string;
  list?: string[];
  o?: string[];
  a?: number;
  e?: string;
  keys?: string;
  task?: string;
  pairs?: { l: string; r: string }[];
  items?: string[];
};

/** v1 yozma savol-javob sahifasidagi element */
export type V1Written = { s: string; k: "n" | "m" | "s"; q: string; a: string[]; show: string; src?: string; e?: string };

export type RawItem = {
  origin: string;
  doc: number | null;
  /** darslik mavzusi: { grade: 8, label: "8-sinf darsligi · 1–6-dars" } */
  textbook: { grade: number; label: string | null } | null;
} & ({ kind: "v1"; item: V1Item } | { kind: "written"; item: V1Written });

// Bank kodlari → hujjat raqami (kodlar nomidan aniq; D… — darslik bloklari)
const BANK_DOC: Record<string, number> = {
  BAYROQ: 2, GERB: 3, MADHIYA: 4, VIJDON: 5, PARTIYA: 6, VM: 7, AD: 8, FQ: 11, KONST1: 1, KONST2: 1, NHH: 19,
  SAYLOV: 25, REF: 24, PROK: 23, SUD: 27, ADLIYA: 28, NOTARIAT: 20, OOOB: 34, MAHALLIY: 35, FK1_D10_1: 10,
  FK2_D10_2: 10, OILA_D10_3: 21, IST_D10_4: 12, MUALLIF_D10_5: 18, MUROJ_D10_6: 32, OMB: 22, MARKAZ: 17,
  JAMOAT: 33, PF: 31, XSH: 29, MK1: 16, MK2: 16, MJK: 15, JK1: 13, JK2: 13, JPK: 14, TABIAT: 30, BYUDJET: 9,
  SOLIQ: 26,
};

// 2-qism quiz fayllari → hujjat
const QISM2_DOC: Record<string, number> = {
  quiz_3_2: 21, quiz_3_3: 31, quiz_3_4: 22, quiz_3_5: 17, quiz_3_6: 12, quiz_3_7: 32, quiz_3_8: 33, quiz_3_9: 18,
  quiz_3_10: 29, quiz_4_1: 16, quiz_4_2: 15, quiz_4_3: 13, quiz_4_4: 14, quiz_4_5: 30,
};

const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;

/** HTML ichidagi `const NAME = {...}` JSON literalini ajratadi */
export function extractJsConst<T>(html: string, name: string): T | null {
  const m = new RegExp(`const\\s+${name}\\s*=\\s*`).exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  // JSON.parse to'liq qatorni talab qiladi — qavslarni sanab literal oxirini topamiz
  let depth = 0;
  let inStr = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inStr) {
      if (c === "\\") i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1)) as T;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** kalit*.py dagi "D8_1":"8-sinf darsligi · 1–6-dars" yozuvlari */
function textbookLabels(pyFile: string): Record<string, string> {
  if (!existsSync(pyFile)) return {};
  const out: Record<string, string> = {};
  for (const m of readFileSync(pyFile, "utf8").matchAll(/"(D\d+_\d+)"\s*:\s*"([^"]+)"/g)) out[m[1]] = m[2];
  return out;
}

function textbookFromCode(code: string, labels: Record<string, string>) {
  const m = /D(\d+)_\d+/.exec(code);
  return m ? { grade: Number(m[1]), label: labels[m[0]] ?? null } : null;
}

function textbookFromTitle(title: string | undefined) {
  const m = title ? /(\d+)-sinf/.exec(title) : null;
  return title && /darslig/i.test(title) && m ? { grade: Number(m[1]), label: null } : null;
}

/** Savolning o'z manbasi (src) darslikni ko'rsatsa — u darslik savoli (bank kodi aralash bo'lsa ham) */
function classify(src: string | undefined, fallbackDoc: number | null) {
  const textbook = textbookFromTitle(src);
  return textbook ? { doc: null, textbook } : { doc: fallbackDoc, textbook: null };
}

export function readAllSources(root: string): { items: RawItem[]; log: string[] } {
  const items: RawItem[] = [];
  const log: string[] = [];
  const gen = join(root, "09_DARS_MATERIALLARI/_generator");

  // 1) Haftalik banklar — eng boy manba (qiyinlik, manba, izoh bor)
  const bankFiles = readdirSync(gen).filter((f) => /^banks(_w\d+)?\.json$/.test(f)).sort();
  for (const f of bankFiles) {
    const week = /_w(\d+)/.exec(f)?.[1];
    const labels = textbookLabels(join(gen, week ? `kalit${week}.py` : "kalit.py"));
    const bank = readJson<Record<string, V1Item[]>>(join(gen, f));
    let n = 0;
    for (const [code, list] of Object.entries(bank)) {
      const doc = BANK_DOC[code] ?? null;
      const textbook = doc ? null : textbookFromCode(code, labels);
      if (!doc && !textbook) log.push(`⚠ ${f}: noma'lum kod ${code}`);
      for (const item of list) {
        const c = doc ? classify(item.src, doc) : { doc, textbook };
        items.push({ kind: "v1", item, origin: `${f}#${code}`, ...c });
        n++;
      }
    }
    log.push(`${f}: ${n}`);
  }

  // 2) 3-qism (№36–52) — bob01..bob17 tartibda
  const q3 = join(root, "03_QONUNCHILIK_TOPLAMI_KITOB_LOYIHASI/3-qism/QUIZ");
  for (let b = 1; b <= 17; b++) {
    const f = join(q3, `bob${String(b).padStart(2, "0")}.html`);
    const quiz = extractJsConst<{ questions: V1Item[] }>(readFileSync(f, "utf8"), "QUIZ");
    if (!quiz) throw new Error(`QUIZ topilmadi: ${f}`);
    for (const item of quiz.questions) items.push({ kind: "v1", item, origin: `3-qism/${basename(f)}`, doc: 35 + b, textbook: null });
    log.push(`3-qism/${basename(f)} → №${35 + b}: ${quiz.questions.length}`);
  }

  // 3) 2-qism quizlari
  const q2 = join(root, "03_QONUNCHILIK_TOPLAMI_KITOB_LOYIHASI/2-qism_manbalar");
  for (const [name, doc] of Object.entries(QISM2_DOC)) {
    const quiz = extractJsConst<{ questions: V1Item[] }>(readFileSync(join(q2, `${name}.html`), "utf8"), "QUIZ");
    if (!quiz) throw new Error(`QUIZ topilmadi: ${name}`);
    for (const item of quiz.questions) items.push({ kind: "v1", item, origin: `2-qism/${name}`, doc, textbook: null });
    log.push(`2-qism/${name} → №${doc}: ${quiz.questions.length}`);
  }

  // 4) Mavzular banki (saytdagi "mavzular" sahifasi)
  const mavzu = readJson<{ t: string; q: V1Item[] }[]>(join(root, "05_TEXNIK_ONLAYN_TIZIM/deploy_kunlik_test/mavzu.json"));
  for (const group of mavzu) {
    const textbook = textbookFromTitle(group.t);
    const doc = textbook ? null : resolveDocument(group.t);
    if (!doc && !textbook) log.push(`⚠ mavzu.json: aniqlanmadi — ${group.t}`);
    for (const item of group.q) items.push({ kind: "v1", item, origin: `mavzu.json#${group.t}`, doc, textbook });
  }
  log.push(`mavzu.json: ${mavzu.reduce((s, g) => s + g.q.length, 0)}`);

  // 5) Haftalik va modul testlari (asosan banklarning takrori — dublikat sifatida tushib qoladi)
  const tests = readdirSync(gen).filter((f) => /^(test_w\d+|modul\d_test)\.json$/.test(f)).sort();
  for (const f of tests) {
    const list = readJson<V1Item[]>(join(gen, f));
    for (const item of list) items.push({ kind: "v1", item, origin: f, ...classify(item.src, resolveDocument(item.src)) });
    log.push(`${f}: ${list.length}`);
  }

  // 6) Saytdagi kunlik/haftalik sahifalar
  const site = join(root, "05_TEXNIK_ONLAYN_TIZIM/deploy_kunlik_test");
  for (const dir of readdirSync(site).filter((d) => /^\d\d-hafta$/.test(d)).sort()) {
    for (const f of readdirSync(join(site, dir)).filter((x) => /(QUIZ|TEST)\.html$/.test(x))) {
      const quiz = extractJsConst<{ questions: V1Item[] }>(readFileSync(join(site, dir, f), "utf8"), "QUIZ");
      if (!quiz) continue;
      for (const item of quiz.questions) {
        items.push({ kind: "v1", item, origin: `sayt/${dir}/${f}`, ...classify(item.src, resolveDocument(item.src)) });
      }
    }
  }

  // 7) Yozma savol-javob (100 ta)
  const sj = extractJsConst<{ items: V1Written[] }>(
    readFileSync(join(root, "05_TEXNIK_ONLAYN_TIZIM/deploy_savol_javob_3hafta/index.html"), "utf8"),
    "DATA",
  );
  if (!sj) throw new Error("savol-javob DATA topilmadi");
  const WRITTEN_DOC: Record<string, number> = { K1: 1, K2: 1, NHH: 19 };
  for (const item of sj.items) {
    const doc = WRITTEN_DOC[item.s] ?? null;
    const textbook = item.s === "D9" ? { grade: 9, label: null } : null;
    items.push({ kind: "written", item, origin: `savol-javob#${item.s}`, doc, textbook });
  }
  log.push(`savol-javob: ${sj.items.length}`);

  return { items, log };
}
