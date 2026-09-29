// RawItem → yagona savol formati (DB: questions). Tekshiradi, barmoq izi (fingerprint) va
// deterministik aralashtirish bilan payload'dan javobga ishorani olib tashlaydi.
import { createHash } from "node:crypto";
import type { Answer, Payload, QuestionType } from "../../src/lib/questions";
import type { RawItem } from "./sources";

export type ImportedQuestion = {
  legacyKey: string;
  type: QuestionType;
  stem: string;
  context: string | null;
  payload: Payload;
  answer: Answer;
  explanation: string | null;
  sourceNote: string | null;
  difficulty: 1 | 2 | 3;
  doc: number | null;
  textbook: { grade: number; label: string | null } | null;
  origins: string[];
};

export type Rejected = { origin: string; reason: string; preview: string };

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "");
const fp = (s: string) => clean(s).toLowerCase().replace(/[‘’ʻʼ`´']/g, "'").replace(/[«»“”„"]/g, "");

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Seed'li aralashtirish (mulberry32) — har importda bir xil natija */
function seededShuffle<T>(arr: T[], seed: string): number[] {
  let a = parseInt(hash(seed).slice(0, 8), 16);
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = arr.map((_, i) => i);
  for (let attempt = 0; attempt < 10; attempt++) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    // asl tartib qolib ketmasin — aks holda javob ko'rinib turadi
    if (idx.length < 2 || idx.some((v, i) => v !== i)) break;
  }
  return idx;
}

function difficulty(d: unknown): 1 | 2 | 3 {
  return d === 1 || d === 2 || d === 3 ? d : 2;
}

export function normalize(raw: RawItem): ImportedQuestion | Rejected {
  const reject = (reason: string, preview: string): Rejected => ({ origin: raw.origin, reason, preview: preview.slice(0, 90) });
  const base = { doc: raw.doc, textbook: raw.textbook, origins: [raw.origin] };

  if (raw.kind === "written") {
    const w = raw.item;
    const stem = clean(w.q);
    const accepted = (w.a ?? []).map(clean).filter(Boolean);
    if (!stem || !accepted.length || !clean(w.show)) return reject("yozma: savol yoki javob bo'sh", stem);
    const kind = w.k === "n" ? "number" : w.k === "m" ? "article" : "text";
    if (kind !== "text" && !Number.isFinite(parseFloat(accepted[0]))) return reject("yozma: son kutilgan", stem);
    return {
      ...base,
      legacyKey: `v1:${hash(`open|${fp(stem)}`).slice(0, 20)}`,
      type: "open",
      stem,
      context: null,
      payload: { kind },
      answer: { accepted, show: clean(w.show) },
      explanation: clean(w.e) || null,
      sourceNote: clean(w.src) || null,
      difficulty: 2,
    };
  }

  const it = raw.item;
  const explanation = clean(it.e) || null;
  const sourceNote = clean(it.src) || null;
  const d = difficulty(it.d);

  if (it.type === "mc" || it.type === "fb" || it.type === "keys") {
    const stem = clean(it.q);
    const options = (it.o ?? []).map(clean);
    const a = it.a;
    if (!stem) return reject("savol matni bo'sh", JSON.stringify(it));
    if (options.length < 2 || options.some((o) => !o)) return reject("variantlar yetarli emas yoki bo'sh", stem);
    if (typeof a !== "number" || a < 0 || a >= options.length) return reject(`javob indeksi noto'g'ri (${a})`, stem);
    if (new Set(options.map(fp)).size !== options.length) return reject("takroriy variantlar", stem);
    const statements = it.list?.map(clean).filter(Boolean);
    const context = it.type === "keys" ? clean(it.keys) || null : null;
    if (it.type === "keys" && !context) return reject("kazus sharti bo'sh", stem);
    const type: QuestionType = it.type === "fb" ? "fill_blank" : it.type === "keys" ? "case" : "single";
    const key = `${type}|${fp(context ?? "")}|${fp(stem)}|${(statements ?? []).map(fp).join("¦")}|${options.map(fp).sort().join("¦")}`;
    return {
      ...base,
      legacyKey: `v1:${hash(key).slice(0, 20)}`,
      type,
      stem,
      context,
      payload: statements?.length ? { options, statements } : { options },
      answer: { index: a },
      explanation,
      sourceNote,
      difficulty: d,
    };
  }

  if (it.type === "dd") {
    const stem = clean(it.task);
    const pairs = (it.pairs ?? []).map((p) => ({ l: clean(p.l), r: clean(p.r) }));
    if (!stem || pairs.length < 2 || pairs.some((p) => !p.l || !p.r)) return reject("moslashtirish: juftliklar noto'g'ri", stem);
    const key = `matching|${fp(stem)}|${pairs.map((p) => `${fp(p.l)}=${fp(p.r)}`).sort().join("¦")}`;
    // "Ko'pga-bir" moslik bo'lishi mumkin (bir nechta organ — "5 yil"): o'ng ustun unikal qiymatlardan tuziladi
    const uniqueRight = [...new Map(pairs.map((p) => [fp(p.r), p.r])).values()];
    const perm = seededShuffle(uniqueRight, key); // right[k] = uniqueRight[perm[k]]
    const right = perm.map((i) => uniqueRight[i]);
    const map = pairs.map((p) => right.findIndex((r) => fp(r) === fp(p.r)));
    return {
      ...base,
      legacyKey: `v1:${hash(key).slice(0, 20)}`,
      type: "matching",
      stem,
      context: null,
      payload: { left: pairs.map((p) => p.l), right },
      answer: { map },
      explanation,
      sourceNote,
      difficulty: d,
    };
  }

  if (it.type === "ord") {
    const stem = clean(it.task);
    const correct = (it.items ?? []).map(clean);
    if (!stem || correct.length < 2 || correct.some((x) => !x)) return reject("tartiblash: elementlar noto'g'ri", stem);
    const key = `ordering|${fp(stem)}|${correct.map(fp).join("¦")}`;
    const perm = seededShuffle(correct, key); // items[k] = correct[perm[k]]
    const items = perm.map((i) => correct[i]);
    const order = correct.map((_, i) => perm.indexOf(i));
    return {
      ...base,
      legacyKey: `v1:${hash(key).slice(0, 20)}`,
      type: "ordering",
      stem,
      context: null,
      payload: { items },
      answer: { order },
      explanation,
      sourceNote,
      difficulty: d,
    };
  }

  return reject(`noma'lum tur: ${(it as { type: string }).type}`, JSON.stringify(it));
}

export function isRejected(x: ImportedQuestion | Rejected): x is Rejected {
  return "reason" in x;
}

/**
 * Dublikatlarni birlashtiradi: birinchi uchragani (eng boy manba) qoladi, keyingilaridan
 * yetishmayotgan hujjat/darslik, izoh va manba to'ldiriladi.
 */
export type Conflict = { stem: string; kept: string; other: string; origins: string[] };

/** Javob sifatida ko'rsatiladigan matn — dublikatlar javobi bir xilligini solishtirish uchun */
function answerText(q: ImportedQuestion): string {
  if ("options" in q.payload && "index" in q.answer) return fp(q.payload.options[q.answer.index]);
  if ("left" in q.payload && "map" in q.answer) {
    const { left, right } = q.payload;
    return q.answer.map.map((r, i) => `${fp(left[i])}=${fp(right[r])}`).sort().join("¦");
  }
  if ("items" in q.payload && "order" in q.answer) {
    const { items } = q.payload;
    return q.answer.order.map((i) => fp(items[i])).join("¦");
  }
  return "accepted" in q.answer ? q.answer.accepted.map(fp).sort().join("¦") : "";
}

export function dedupe(list: ImportedQuestion[]): { questions: ImportedQuestion[]; conflicts: Conflict[] } {
  const byKey = new Map<string, ImportedQuestion>();
  const conflicts: Conflict[] = [];
  for (const q of list) {
    const prev = byKey.get(q.legacyKey);
    if (!prev) {
      byKey.set(q.legacyKey, { ...q, origins: [...q.origins] });
      continue;
    }
    if (answerText(prev) !== answerText(q)) {
      conflicts.push({ stem: prev.stem, kept: answerText(prev), other: answerText(q), origins: [prev.origins[0], ...q.origins] });
    }
    prev.origins.push(...q.origins);
    if (prev.doc == null && prev.textbook == null) {
      prev.doc = q.doc;
      prev.textbook = q.textbook;
    }
    prev.explanation ??= q.explanation;
    prev.sourceNote ??= q.sourceNote;
  }
  return { questions: [...byKey.values()], conflicts };
}
