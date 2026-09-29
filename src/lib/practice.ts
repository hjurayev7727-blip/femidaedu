import "server-only";
import { z } from "zod";
import type { Profile } from "@/lib/auth";
import {
  gradeResponse,
  type Answer,
  type ClientQuestion,
  type Payload,
  type QuestionType,
  type Response,
} from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { toScript, type Script } from "@/lib/translit";

/** Bepul tarifda kuniga javob berish mumkin bo'lgan savollar */
export const FREE_DAILY_LIMIT = 20;
export const PRACTICE_SIZE = 10;

export const QUESTION_COLUMNS = "id, type, stem, context, payload, difficulty";

/** Foydalanuvchi tanlagan yozuvga o'girish (kontent lotinda saqlanadi) */
export function localizeQuestion(q: ClientQuestion, script: Script): ClientQuestion {
  if (script === "latin") return q;
  const t = (s: string) => toScript(s, script);
  const p = q.payload as Record<string, unknown>;
  const payload = Object.fromEntries(
    Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => (typeof x === "string" ? t(x) : x)) : v]),
  ) as Payload;
  return { ...q, stem: t(q.stem), context: q.context && t(q.context), payload };
}

const idx = z.number().int().min(0).max(30);
export const ResponseSchema: z.ZodType<Response> = z.union([
  z.object({ index: idx }),
  z.object({ indexes: z.array(idx).max(30) }),
  z.object({ map: z.array(z.number().int().min(-1).max(30)).max(30) }),
  z.object({ order: z.array(idx).max(30) }),
  z.object({ text: z.string().max(300) }),
]);

export type FailReason = "limit" | "finished" | "not_in_attempt" | "duplicate" | "not_found" | "invalid";

export type SubmitResult =
  | {
      ok: true;
      correct: boolean;
      score: number;
      answer: Answer;
      explanation: string | null;
      sourceNote: string | null;
      usedToday: number;
      limit: number | null;
    }
  | { ok: false; reason: FailReason };

/**
 * Javobni tekshiradi va yozadi. To'g'ri javob faqat yozish muvaffaqiyatli bo'lgandan keyin qaytariladi —
 * limitga yetgan yoki begona urinishga javob yuborgan foydalanuvchi javobni ko'ra olmaydi.
 */
export async function submitAnswer(opts: {
  userId: string;
  premium: boolean;
  script: Script;
  attemptId: string;
  questionId: number;
  response: unknown;
  timeMs: number;
}): Promise<SubmitResult> {
  const parsed = ResponseSchema.safeParse(opts.response);
  if (!parsed.success) return { ok: false, reason: "invalid" };

  const admin = createSupabaseAdmin();
  const { data: q, error } = await admin
    .from("questions")
    .select("type, payload, answer, explanation, source_note")
    .eq("id", opts.questionId)
    .eq("status", "published")
    .maybeSingle<{ type: QuestionType; payload: Payload; answer: Answer; explanation: string | null; source_note: string | null }>();
  if (error || !q) return { ok: false, reason: "not_found" };

  const grade = gradeResponse(q.type, q.payload, q.answer, parsed.data);
  const limit = opts.premium ? null : FREE_DAILY_LIMIT;
  const { data: rec, error: recError } = await admin.rpc("record_answer", {
    p_user: opts.userId,
    p_attempt: opts.attemptId,
    p_question: opts.questionId,
    p_response: parsed.data,
    p_correct: grade.correct,
    p_points: grade.score,
    p_time_ms: Math.max(0, Math.min(Math.round(opts.timeMs), 3_600_000)),
    p_limit: limit,
  });
  if (recError) throw new Error(`record_answer: ${recError.message}`);
  const r = rec as { ok: boolean; reason?: FailReason; used_today?: number };
  if (!r.ok) return { ok: false, reason: r.reason ?? "not_found" };

  const t = (s: string | null) => (s ? toScript(s, opts.script) : s);
  return {
    ok: true,
    correct: grade.correct,
    score: grade.score,
    answer: q.answer,
    explanation: t(q.explanation),
    sourceNote: t(q.source_note),
    usedToday: r.used_today ?? 0,
    limit,
  };
}

export function scriptOf(profile: Pick<Profile, "script">): Script {
  return profile.script === "cyrillic" ? "cyrillic" : "latin";
}
