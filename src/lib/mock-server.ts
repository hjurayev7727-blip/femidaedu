import "server-only";
import { mockResultMessage, notifyUser } from "@/lib/bot/server";
import { awardBadges } from "@/lib/contest-server";
import { buildMockPlan, evaluateMock, NotEnoughQuestions, type PlanItem, type PoolQuestion, type Template } from "@/lib/mock";
import { ResponseSchema } from "@/lib/practice";
import type { Answer, Payload, QuestionType, Response } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Bepul tarifda oyiga sinov imtihonlari */
export const FREE_MONTHLY_MOCKS = 1;
export const DEFAULT_TEMPLATE = "milliy-sertifikat-standart";

export async function getTemplate(slug = DEFAULT_TEMPLATE): Promise<Template | null> {
  const { data } = await createSupabaseAdmin()
    .from("exam_templates")
    .select("id, slug, title, duration_min, blueprint, raw_max, scale_max, grades")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle<Template>();
  return data ? { ...data, raw_max: Number(data.raw_max), scale_max: Number(data.scale_max) } : null;
}

export type StartMockResult = { ok: true; id: string } | { ok: false; reason: "limit" | "template" | "questions" | "server" };

export async function startMock(userId: string, premium: boolean): Promise<StartMockResult> {
  const admin = createSupabaseAdmin();
  const template = await getTemplate();
  if (!template) return { ok: false, reason: "template" };

  const { data: rows, error } = await admin
    .from("questions")
    .select("id, type, difficulty, document_id")
    .eq("status", "published")
    .returns<{ id: number; type: QuestionType; difficulty: number; document_id: number | null }[]>();
  if (error || !rows) return { ok: false, reason: "server" };
  const pool: PoolQuestion[] = rows.map((r) => ({ id: Number(r.id), type: r.type, difficulty: r.difficulty, documentId: r.document_id }));

  let plan: PlanItem[];
  try {
    plan = buildMockPlan(pool, template.blueprint);
  } catch (e) {
    if (e instanceof NotEnoughQuestions) return { ok: false, reason: "questions" };
    throw e;
  }

  const { data, error: rpcError } = await admin.rpc("create_mock", {
    p_user: userId,
    p_template: template.id,
    p_plan: plan,
    p_monthly_limit: premium ? null : FREE_MONTHLY_MOCKS,
  });
  if (rpcError) throw new Error(`create_mock: ${rpcError.message}`);
  const r = data as { ok: boolean; id?: string; reason?: "limit" | "template" };
  return r.ok && r.id ? { ok: true, id: r.id } : { ok: false, reason: r.reason ?? "server" };
}

export async function saveMockAnswer(userId: string, attemptId: string, questionId: number, response: unknown) {
  const parsed = ResponseSchema.safeParse(response);
  if (!parsed.success) return { ok: false as const, reason: "invalid" };
  const { data, error } = await createSupabaseAdmin().rpc("save_mock_answer", {
    p_user: userId,
    p_attempt: attemptId,
    p_question: questionId,
    p_response: parsed.data,
  });
  if (error) throw new Error(`save_mock_answer: ${error.message}`);
  return data as { ok: boolean; reason?: string };
}

/** Baholash va yakunlash. Qayta chaqirish xavfsiz (allaqachon yakunlangan bo'lsa o'zgarmaydi). */
export async function finishMock(userId: string, attemptId: string): Promise<{ ok: boolean }> {
  const admin = createSupabaseAdmin();
  const { data: attempt } = await admin
    .from("attempts")
    .select("id, user_id, mode, plan, finished_at, template_id")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .eq("mode", "mock")
    .maybeSingle<{ id: string; plan: PlanItem[]; finished_at: string | null; template_id: number }>();
  if (!attempt) return { ok: false };
  if (attempt.finished_at) return { ok: true };

  const [{ data: template }, { data: answers }, { data: questions }] = await Promise.all([
    admin.from("exam_templates").select("raw_max, scale_max, grades").eq("id", attempt.template_id).single<Pick<Template, "raw_max" | "scale_max" | "grades">>(),
    admin.from("attempt_answers").select("question_id, response").eq("attempt_id", attemptId).returns<{ question_id: number; response: Response }[]>(),
    admin
      .from("questions")
      .select("id, type, payload, answer, document_id, documents(short_title)")
      .in("id", attempt.plan.map((p) => p.q))
      .returns<{ id: number; type: QuestionType; payload: Payload; answer: Answer; document_id: number | null; documents: { short_title: string } | null }[]>(),
  ]);
  if (!template || !questions) return { ok: false };

  const { results, score, breakdown } = evaluateMock(
    attempt.plan,
    questions.map((q) => ({ ...q, id: Number(q.id), docTitle: q.documents?.short_title ?? null })),
    new Map((answers ?? []).map((a) => [Number(a.question_id), a.response])),
    { ...template, raw_max: Number(template.raw_max), scale_max: Number(template.scale_max) },
  );

  const { data: fin, error } = await admin.rpc("finish_mock", {
    p_user: userId,
    p_attempt: attemptId,
    p_results: results,
    p_raw: score.raw,
    p_scaled: score.scaled,
    p_grade: score.grade,
    p_correct: score.correct,
    p_breakdown: breakdown,
  });
  if (error) throw new Error(`finish_mock: ${error.message}`);

  // Natijani botga yuborish — faqat birinchi marta yakunlanganda (parallel yakunlash ikki marta yubormaydi)
  if (!(fin as { already?: boolean } | null)?.already) {
    await awardBadges(userId);
    await notifyUser(
      userId,
      mockResultMessage({ grade: score.grade, scaled: score.scaled, raw: score.raw, correct: score.correct, total: attempt.plan.length }),
      { text: "📊 Tahlilni ko'rish", path: `/app/imtihon/${attemptId}/natija` },
    );
  }
  return { ok: true };
}
