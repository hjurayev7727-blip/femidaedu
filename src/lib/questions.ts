// Savol modeli (DB dagi questions.type / payload / answer) va javobni tekshirish.
// payload mijozga ko'rinadi — unda to'g'ri javobga ishora bo'lmasligi kerak.
// answer faqat serverda o'qiladi.
import { isOpenAnswerRight, type OpenKind } from "@/lib/grading-open";

export type QuestionType = "single" | "multi" | "matching" | "ordering" | "fill_blank" | "case" | "open";

export type ChoicePayload = { options: string[]; statements?: string[] };
export type MatchingPayload = { left: string[]; right: string[] };
export type OrderingPayload = { items: string[] };
export type OpenPayload = { kind: OpenKind };

export type Payload = ChoicePayload | MatchingPayload | OrderingPayload | OpenPayload;

export type ChoiceAnswer = { index: number };
export type MultiAnswer = { indexes: number[] };
/** map[i] — chap ustundagi i-element uchun o'ng ustundagi to'g'ri indeks */
export type MatchingAnswer = { map: number[] };
/** order — payload.items indekslarining to'g'ri ketma-ketligi */
export type OrderingAnswer = { order: number[] };
export type OpenAnswer = { accepted: string[]; show: string };

export type Answer = ChoiceAnswer | MultiAnswer | MatchingAnswer | OrderingAnswer | OpenAnswer;

export type Response =
  | { index: number }
  | { indexes: number[] }
  | { map: number[] }
  | { order: number[] }
  | { text: string };

/** Mijozga yuboriladigan savol — javobsiz (DB: questions ning ochiq ustunlari) */
export type ClientQuestion = {
  id: number;
  type: QuestionType;
  stem: string;
  context: string | null;
  payload: Payload;
  difficulty: number;
};

export type GradeResult = {
  correct: boolean;
  /** 0..1 — moslashtirish/tartiblashda qisman to'g'ri javob ulushi (mashq statistikasi uchun) */
  score: number;
};

export const CHOICE_TYPES: QuestionType[] = ["single", "fill_blank", "case"];

const sameArray = (a: unknown, b: number[]) =>
  Array.isArray(a) && a.length === b.length && a.every((x, i) => x === b[i]);

export function gradeResponse(type: QuestionType, payload: Payload, answer: Answer, response: Response): GradeResult {
  switch (type) {
    case "single":
    case "fill_blank":
    case "case": {
      const ok = "index" in response && response.index === (answer as ChoiceAnswer).index;
      return { correct: ok, score: ok ? 1 : 0 };
    }
    case "multi": {
      const want = [...(answer as MultiAnswer).indexes].sort((a, b) => a - b);
      const got = "indexes" in response ? [...new Set(response.indexes)].sort((a, b) => a - b) : [];
      const ok = sameArray(got, want);
      return { correct: ok, score: ok ? 1 : 0 };
    }
    case "matching": {
      const want = (answer as MatchingAnswer).map;
      const got = "map" in response ? response.map : [];
      const hits = want.filter((r, i) => got[i] === r).length;
      return { correct: hits === want.length, score: want.length ? hits / want.length : 0 };
    }
    case "ordering": {
      const want = (answer as OrderingAnswer).order;
      const got = "order" in response ? response.order : [];
      const hits = want.filter((v, i) => got[i] === v).length;
      return { correct: sameArray(got, want), score: want.length ? hits / want.length : 0 };
    }
    case "open": {
      const text = "text" in response ? response.text : "";
      const ok = isOpenAnswerRight(answer as OpenAnswer, text, (payload as OpenPayload).kind);
      return { correct: ok, score: ok ? 1 : 0 };
    }
  }
}

/** Javobni foydalanuvchiga ko'rsatish uchun matn (javobdan keyin) */
export function describeAnswer(type: QuestionType, payload: Payload, answer: Answer): string {
  switch (type) {
    case "single":
    case "fill_blank":
    case "case": {
      const i = (answer as ChoiceAnswer).index;
      return `${String.fromCharCode(65 + i)}) ${(payload as ChoicePayload).options[i]}`;
    }
    case "multi":
      return (answer as MultiAnswer).indexes.map((i) => String.fromCharCode(65 + i)).join(", ");
    case "matching": {
      const p = payload as MatchingPayload;
      return (answer as MatchingAnswer).map.map((r, i) => `${p.left[i]} — ${p.right[r]}`).join("; ");
    }
    case "ordering": {
      const p = payload as OrderingPayload;
      return (answer as OrderingAnswer).order.map((i) => p.items[i]).join(" → ");
    }
    case "open":
      return (answer as OpenAnswer).show;
  }
}

/** Foydalanuvchi javobini matn ko'rinishida (natija sahifasi uchun) */
export function describeResponse(type: QuestionType, payload: Payload, response: Response | null): string {
  if (!response) return "Javob berilmagan";
  if ("text" in response) return response.text || "—";
  if ("map" in response && type === "matching") {
    const p = payload as MatchingPayload;
    return response.map.map((r, i) => `${p.left[i]} — ${p.right[r] ?? "?"}`).join("; ");
  }
  if (("index" in response || "indexes" in response || "order" in response) && type !== "open") {
    try {
      return describeAnswer(type, payload, response as Answer);
    } catch {
      return "—";
    }
  }
  return "—";
}
