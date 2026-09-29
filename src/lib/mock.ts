// Sinov imtihoni: shablon (exam_templates.blueprint) bo'yicha savollar rejasi, ball va daraja.
// Sof funksiyalar — server ham, testlar ham ishlatadi.
import { gradeResponse, type Answer, type Payload, type QuestionType, type Response } from "@/lib/questions";

export type Blueprint = {
  sections: { from: number; to: number; kind: "closed" | "written"; types: QuestionType[]; parts?: string[] }[];
  /** 1–35 yopiq topshiriqlar qiyinlik taqsimoti: {"1":10,"2":18,"3":7} */
  closed_difficulty_mix: Record<string, number>;
  points: { closed: Record<string, number>; written_part: Record<string, number> };
  /** yozma topshiriqlar qismlari bali (rasmiy kalit namunasidagidek), masalan [[1.1,1.1],[1.5,1.7],…] */
  written_points?: number[][];
};

export type Grade = { grade: string; min: number };

export type Template = {
  id: number;
  slug: string;
  title: string;
  duration_min: number;
  blueprint: Blueprint;
  raw_max: number;
  scale_max: number;
  grades: Grade[];
};

export type PoolQuestion = { id: number; type: QuestionType; difficulty: number; documentId: number | null };

export type PlanItem = {
  /** topshiriq raqami (1–45) */
  n: number;
  /** yozma topshiriq qismi */
  part: "a" | "b" | null;
  q: number;
  points: number;
  kind: "closed" | "written";
};

/** Bitta hujjatdan yopiq qismda eng ko'pi bilan nechta savol (xilma-xillik uchun) */
const MAX_PER_DOC = 3;

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class NotEnoughQuestions extends Error {}

/**
 * Shablon bo'yicha reja tuzadi. Ball slotga tegishli (qiyinlik taqsimotidan) — shuning uchun
 * biror qiyinlikdagi savol yetmasa ham jami ball o'zgarmaydi, faqat boshqa qiyinlikdagi savol olinadi.
 */
export function buildMockPlan(pool: PoolQuestion[], bp: Blueprint, rand: () => number = Math.random): PlanItem[] {
  const used = new Set<number>();
  const perDoc = new Map<number, number>();
  const plan: PlanItem[] = [];

  const closedSections = bp.sections.filter((s) => s.kind === "closed");
  const closedSlots = closedSections.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => ({ n: s.from + i, types: s.types })));
  const difficulties = shuffle(
    Object.entries(bp.closed_difficulty_mix).flatMap(([d, count]) => Array<number>(count).fill(Number(d))),
    rand,
  );
  if (difficulties.length !== closedSlots.length) {
    throw new Error(`Shablon xato: qiyinlik taqsimoti (${difficulties.length}) ≠ yopiq topshiriqlar (${closedSlots.length})`);
  }

  const byType = new Map<QuestionType, PoolQuestion[]>();
  for (const q of shuffle(pool, rand)) {
    byType.set(q.type, [...(byType.get(q.type) ?? []), q]);
  }
  const candidates = (types: QuestionType[]) => types.flatMap((t) => byType.get(t) ?? []);

  closedSlots.forEach((slot, i) => {
    const wantD = difficulties[i];
    const list = candidates(slot.types).filter((q) => !used.has(q.id));
    const docOk = (q: PoolQuestion) => q.documentId == null || (perDoc.get(q.documentId) ?? 0) < MAX_PER_DOC;
    const pick =
      list.find((q) => q.difficulty === wantD && docOk(q)) ??
      list.find((q) => docOk(q)) ??
      list.find((q) => q.difficulty === wantD) ??
      list[0];
    if (!pick) throw new NotEnoughQuestions(`${slot.n}-topshiriq uchun savol yetmadi (${slot.types.join(", ")})`);
    used.add(pick.id);
    if (pick.documentId != null) perDoc.set(pick.documentId, (perDoc.get(pick.documentId) ?? 0) + 1);
    plan.push({ n: slot.n, part: null, q: pick.id, points: bp.points.closed[String(wantD)], kind: "closed" });
  });

  // Yozma topshiriqlar: har biri a) va b) qism — iloji bo'lsa bir hujjatdan
  const written = bp.sections.filter((s) => s.kind === "written");
  let w = 0;
  for (const s of written) {
    for (let n = s.from; n <= s.to; n++, w++) {
      const pts = bp.written_points?.[w] ?? [bp.points.written_part["2"], bp.points.written_part["2"]];
      const list = candidates(s.types).filter((q) => !used.has(q.id));
      const a = list[0];
      const b = a && (list.find((q) => q.id !== a.id && q.documentId === a.documentId) ?? list.find((q) => q.id !== a.id));
      if (!a || !b) throw new NotEnoughQuestions(`${n}-yozma topshiriq uchun savol yetmadi`);
      used.add(a.id).add(b.id);
      plan.push({ n, part: "a", q: a.id, points: pts[0], kind: "written" });
      plan.push({ n, part: "b", q: b.id, points: pts[1], kind: "written" });
    }
  }
  return plan;
}

export function planMax(plan: PlanItem[]): number {
  return Math.round(plan.reduce((s, p) => s + p.points, 0) * 100) / 100;
}

export function gradeFor(scaled: number, grades: Grade[]): string | null {
  return [...grades].sort((a, b) => b.min - a.min).find((g) => scaled >= g.min)?.grade ?? null;
}

export type MockScore = { raw: number; scaled: number; grade: string | null; correct: number };

/** Birlamchi ball → shkala (raw_max → scale_max) → daraja */
export function scoreMock(
  plan: PlanItem[],
  correctByQuestion: Map<number, boolean>,
  t: Pick<Template, "raw_max" | "scale_max" | "grades">,
): MockScore {
  let raw = 0;
  let correct = 0;
  for (const p of plan) {
    if (correctByQuestion.get(p.q)) {
      raw += p.points;
      correct++;
    }
  }
  raw = Math.round(raw * 100) / 100;
  const scaled = Math.round(((raw * t.scale_max) / t.raw_max) * 10) / 10;
  return { raw, scaled, grade: gradeFor(scaled, t.grades), correct };
}

/** Topshiriq yorlig'i: "12", "36a" */
export function planLabel(p: Pick<PlanItem, "n" | "part">): string {
  return `${p.n}${p.part ?? ""}`;
}

export type Breakdown = {
  /** hujjatlar bo'yicha — eng zaifi birinchi */
  byDoc: { doc: number | null; title: string; earned: number; max: number }[];
  closed: { earned: number; max: number };
  written: { earned: number; max: number };
};

export type EvalQuestion = { id: number; type: QuestionType; payload: Payload; answer: Answer; document_id: number | null; docTitle: string | null };

/** Sinovni baholash: har bir javob, birlamchi/shkala ball, daraja va hujjatlar bo'yicha tahlil */
export function evaluateMock(
  plan: PlanItem[],
  questions: EvalQuestion[],
  responses: Map<number, Response>,
  t: Pick<Template, "raw_max" | "scale_max" | "grades">,
) {
  const qById = new Map(questions.map((q) => [q.id, q]));
  const correct = new Map<number, boolean>();
  const results: { q: number; correct: boolean; points: number }[] = [];
  const docs = new Map<string, Breakdown["byDoc"][number]>();
  const kinds = { closed: { earned: 0, max: 0 }, written: { earned: 0, max: 0 } };

  for (const p of plan) {
    const q = qById.get(p.q);
    const resp = responses.get(p.q);
    const ok = Boolean(q && resp && gradeResponse(q.type, q.payload, q.answer, resp).correct);
    correct.set(p.q, ok);
    if (resp) results.push({ q: p.q, correct: ok, points: ok ? p.points : 0 });

    const key = String(q?.document_id ?? "darslik");
    const d = docs.get(key) ?? { doc: q?.document_id ?? null, title: q?.docTitle ?? "Darsliklar", earned: 0, max: 0 };
    d.max += p.points;
    if (ok) d.earned += p.points;
    docs.set(key, d);
    kinds[p.kind].max += p.points;
    if (ok) kinds[p.kind].earned += p.points;
  }

  const round = (x: number) => Math.round(x * 100) / 100;
  const breakdown: Breakdown = {
    byDoc: [...docs.values()]
      .map((d) => ({ ...d, earned: round(d.earned), max: round(d.max) }))
      .sort((a, b) => a.earned / a.max - b.earned / b.max || b.max - a.max),
    closed: { earned: round(kinds.closed.earned), max: round(kinds.closed.max) },
    written: { earned: round(kinds.written.earned), max: round(kinds.written.max) },
  };
  return { results, score: scoreMock(plan, correct, t), breakdown };
}
