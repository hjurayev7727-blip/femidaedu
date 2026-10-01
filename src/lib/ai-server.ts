import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { draftToQuestion, explainQuestion, generateDrafts, regradeOpenAnswer, type AiUsage, type Draft } from "@/lib/ai";
import { describeAnswer, describeResponse, type Answer, type OpenAnswer, type Payload, type QuestionType, type Response } from "@/lib/questions";
import { isPracticeMode } from "@/lib/practice";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { toScript, type Script } from "@/lib/translit";

/** Premium foydalanuvchi uchun kunlik AI so'rovlari */
export const AI_DAILY_LIMIT = 30;
/** Muallif uchun kunlik generator so'rovlari (xarajat nazorati) */
export const AUTHOR_DAILY_LIMIT = 40;

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function aiClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function logUsage(userId: string | null, purpose: string, u: AiUsage) {
  await createSupabaseAdmin()
    .from("ai_usage")
    .insert({ user_id: userId, purpose, model: u.model, input_tokens: u.input_tokens, output_tokens: u.output_tokens });
}

async function consume(userId: string, limit: number | null) {
  const { data } = await createSupabaseAdmin().rpc("consume_ai_quota", { p_user: userId, p_limit: limit });
  return Boolean(data);
}

export type AiResult<T> = { ok: true; value: T } | { ok: false; message: string };

const FAIL_TEXT = {
  premium: "Bu imkoniyat Premium foydalanuvchilar uchun.",
  unavailable: "AI hozircha ulanmagan.",
  limit: `Bugungi AI limiti (${AI_DAILY_LIMIT} ta so'rov) tugadi. Ertaga davom eting.`,
  error: "AI javob bera olmadi. Birozdan keyin urinib ko'ring.",
  refusal: "AI bu so'rovga javob bermadi.",
};

type AnswerRow = {
  response: Response;
  is_correct: boolean | null;
  ai_feedback: unknown;
  attempts: { user_id: string; mode: string } | null;
  questions: { type: QuestionType; stem: string; context: string | null; payload: Payload; answer: Answer; explanation: string | null; source_note: string | null } | null;
};

/** Foydalanuvchining o'z javobi (javob berilgandan keyingina AI ochiladi — javob oshkor bo'lmasin) */
async function loadOwnAnswer(userId: string, attemptId: string, questionId: number) {
  const { data } = await createSupabaseAdmin()
    .from("attempt_answers")
    .select("response, is_correct, ai_feedback, attempts!inner(user_id, mode), questions!inner(type, stem, context, payload, answer, explanation, source_note)")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle<AnswerRow>();
  return data && data.attempts?.user_id === userId && data.questions ? data : null;
}

export async function aiRegrade(
  userId: string, premium: boolean, attemptId: string, questionId: number, script: Script,
): Promise<AiResult<{ correct: boolean; comment: string }>> {
  if (!premium) return { ok: false, message: FAIL_TEXT.premium };
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL_TEXT.unavailable };
  const row = await loadOwnAnswer(userId, attemptId, questionId);
  const q = row?.questions;
  if (!row || !q || q.type !== "open" || (q.payload as { kind: string }).kind !== "text") return { ok: false, message: "Faqat matnli yozma javob qayta tekshiriladi." };
  if (!isPracticeMode(row.attempts?.mode ?? "")) return { ok: false, message: "Sinov va musobaqa natijasi o'zgartirilmaydi." };
  if (row.is_correct) return { ok: false, message: "Javob allaqachon to'g'ri." };
  if (row.ai_feedback) return { ok: false, message: "Bu javob AI tomonidan tekshirilgan." };
  if (!(await consume(userId, AI_DAILY_LIMIT))) return { ok: false, message: FAIL_TEXT.limit };

  const a = q.answer as OpenAnswer;
  const r = await regradeOpenAnswer(c, { stem: q.stem, accepted: a.accepted, show: a.show, explanation: q.explanation }, "text" in row.response ? row.response.text : "");
  if (!r.ok) return { ok: false, message: r.reason === "refusal" ? FAIL_TEXT.refusal : FAIL_TEXT.error };
  await logUsage(userId, "grade_open", r.usage);

  const correct = r.data.verdict === "correct";
  const { data } = await createSupabaseAdmin().rpc("apply_ai_regrade", {
    p_user: userId,
    p_attempt: attemptId,
    p_question: questionId,
    p_correct: correct,
    p_feedback: { verdict: r.data.verdict, comment: r.data.comment, model: r.usage.model },
  });
  if (!(data as { ok: boolean } | null)?.ok) return { ok: false, message: FAIL_TEXT.error };
  return { ok: true, value: { correct, comment: toScript(r.data.comment, script) } };
}

export async function aiExplain(
  userId: string, premium: boolean, attemptId: string, questionId: number, studentQuestion: string, script: Script,
): Promise<AiResult<string>> {
  if (!premium) return { ok: false, message: FAIL_TEXT.premium };
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL_TEXT.unavailable };
  const row = await loadOwnAnswer(userId, attemptId, questionId);
  const q = row?.questions;
  if (!row || !q) return { ok: false, message: "Avval savolga javob bering." };
  // Sinov/musobaqada javob saqlanadi, lekin to'g'ri javob oshkor qilinmasligi kerak
  if (!isPracticeMode(row.attempts?.mode ?? "")) return { ok: false, message: "AI yordamchi sinov va musobaqa paytida ishlamaydi." };
  if (!(await consume(userId, AI_DAILY_LIMIT))) return { ok: false, message: FAIL_TEXT.limit };

  const r = await explainQuestion(
    c,
    {
      stem: q.stem,
      context: q.context,
      answerText: describeAnswer(q.type, q.payload, q.answer),
      explanation: q.explanation,
      sourceNote: q.source_note,
      studentResponse: describeResponse(q.type, q.payload, row.response),
    },
    studentQuestion,
  );
  if (!r.ok) return { ok: false, message: r.reason === "refusal" ? FAIL_TEXT.refusal : FAIL_TEXT.error };
  await logUsage(userId, "explain", r.usage);
  return { ok: true, value: toScript(r.data, script) };
}

export type GenerateReport = { created: number; duplicates: number; rejected: string[] };

/** Qoralamalar yaratib, "ko'rib chiqish" holatida saqlaydi (ekspert tasdiqlamaguncha o'quvchilarga ko'rinmaydi). */
export async function generateAndSave(
  authorId: string,
  opts: { documentNumber: number; sourceText: string; count: number; types: Draft["type"][] },
): Promise<AiResult<GenerateReport>> {
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL_TEXT.unavailable };
  if (!(await consume(authorId, AUTHOR_DAILY_LIMIT))) return { ok: false, message: `Bugungi generator limiti (${AUTHOR_DAILY_LIMIT} ta) tugadi.` };
  const admin = createSupabaseAdmin();
  const { data: doc } = await admin.from("documents").select("id, number, short_title").eq("number", opts.documentNumber)
    .maybeSingle<{ id: number; number: number; short_title: string }>();
  if (!doc) return { ok: false, message: "Hujjat topilmadi." };
  const { data: topic } = await admin.from("topics").select("id").eq("slug", `hujjat-${doc.number}`).maybeSingle<{ id: number }>();

  const r = await generateDrafts(c, { documentTitle: doc.short_title, sourceText: opts.sourceText, count: opts.count, types: opts.types });
  if (!r.ok) return { ok: false, message: r.reason === "truncated" ? "Javob juda uzun — savollar sonini kamaytiring." : FAIL_TEXT.error };
  await logUsage(authorId, "generate", r.usage);

  const rejected: string[] = [];
  const rows = r.data.questions.flatMap((d, i) => {
    const conv = draftToQuestion(d, doc.short_title);
    if (!conv.ok) {
      rejected.push(`${i + 1}: ${conv.reason}`);
      return [];
    }
    const q = conv.q;
    return [{
      legacy_key: `ai:${q.fingerprint}`,
      type: q.type,
      stem: q.stem,
      context: q.context,
      payload: q.payload,
      answer: q.answer,
      explanation: q.explanation,
      source_note: q.sourceNote,
      difficulty: q.difficulty,
      document_id: doc.id,
      topic_id: topic?.id ?? null,
      status: "review",
      source: "ai",
      author_id: authorId,
    }];
  });
  if (!rows.length) return { ok: true, value: { created: 0, duplicates: 0, rejected } };

  const { data: inserted, error } = await admin.from("questions").upsert(rows, { onConflict: "legacy_key", ignoreDuplicates: true }).select("id");
  if (error) return { ok: false, message: "Saqlab bo'lmadi." };
  const created = inserted?.length ?? 0;
  return { ok: true, value: { created, duplicates: rows.length - created, rejected } };
}
