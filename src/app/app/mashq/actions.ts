"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { aiExplain, aiRegrade } from "@/lib/ai-server";
import { awardBadges } from "@/lib/contest-server";
import { requireUser } from "@/lib/auth";
import { PRACTICE_SIZE, scriptOf, submitAnswer, type SubmitResult } from "@/lib/practice";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Mavzu (yoki modul) bo'yicha yangi mashq — katalogdagi forma */
export async function startPractice(form: FormData) {
  const { supabase, userId } = await requireUser();
  const slug = z.string().regex(/^[a-z0-9-]{1,80}$/).safeParse(form.get("slug"));
  if (!slug.success) redirect("/app/mashq");

  const { data: topic } = await supabase.from("topics").select("id").eq("slug", slug.data).maybeSingle<{ id: number }>();
  if (!topic) redirect("/app/mashq?xato=mavzu");

  const { data: attemptId, error } = await createSupabaseAdmin().rpc("start_practice", {
    p_user: userId,
    p_topic: topic.id,
    p_n: PRACTICE_SIZE,
  });
  if (error) redirect(`/app/mashq?xato=${/no_questions/.test(error.message) ? "bosh" : "server"}`);
  redirect(`/app/mashq/s/${attemptId as string}`);
}

export async function answerQuestion(attemptId: string, questionId: number, response: unknown, timeMs: number): Promise<SubmitResult> {
  const { supabase, userId, profile } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success || !Number.isSafeInteger(questionId)) return { ok: false, reason: "invalid" };
  const { data: premium } = await supabase.rpc("is_premium");
  return submitAnswer({
    userId,
    premium: Boolean(premium),
    script: scriptOf(profile),
    attemptId,
    questionId,
    response,
    timeMs: Number(timeMs) || 0,
  });
}

export async function finishPractice(attemptId: string) {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success) redirect("/app/mashq");
  const { error } = await createSupabaseAdmin().rpc("finish_attempt", { p_user: userId, p_attempt: attemptId });
  if (error) redirect("/app/mashq");
  await awardBadges(userId);
  redirect(`/app/mashq/s/${attemptId}/natija`);
}

const ReportInput = z.object({
  questionId: z.number().int().positive(),
  message: z.string().trim().min(3, "Kamida 3 ta belgi").max(1000),
});

export async function reportQuestion(questionId: number, message: string): Promise<{ ok: boolean; message: string }> {
  const { supabase, userId } = await requireUser();
  const input = ReportInput.safeParse({ questionId, message });
  if (!input.success) return { ok: false, message: input.error.issues[0]?.message ?? "Noto'g'ri ma'lumot" };
  // RLS: faqat o'z nomidan va faqat question_id, user_id, message ustunlari
  const { error } = await supabase
    .from("reports")
    .insert({ question_id: input.data.questionId, user_id: userId, message: input.data.message });
  return error ? { ok: false, message: "Yuborib bo'lmadi" } : { ok: true, message: "Rahmat! Ekspert ko'rib chiqadi." };
}

/** Xatolar ustida ishlash — muddati kelgan savollar */
export async function startReview() {
  const { userId } = await requireUser();
  const { data, error } = await createSupabaseAdmin().rpc("start_review", { p_user: userId, p_n: PRACTICE_SIZE });
  if (error) redirect(`/app/takrorlash?xato=${/no_questions/.test(error.message) ? "bosh" : "server"}`);
  redirect(`/app/mashq/s/${data as string}`);
}

/** Kunlik test — kuniga bitta, hamma uchun bir xil 10 savol */
export async function startDaily() {
  const { userId } = await requireUser();
  const { data, error } = await createSupabaseAdmin().rpc("start_daily", { p_user: userId });
  if (error) redirect("/app?xato=kunlik");
  redirect(`/app/mashq/s/${data as string}`);
}

/** O'qituvchi bergan vazifa — bitta urinish (qayta bosilsa davom etadi yoki natijani ko'rsatadi) */
export async function startAssignment(form: FormData) {
  const { userId } = await requireUser();
  const id = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!id.success) redirect("/app");
  const { data } = await createSupabaseAdmin().rpc("start_assignment", { p_user: userId, p_assignment: id.data });
  const r = data as { ok: boolean; id?: string } | null;
  redirect(r?.ok && r.id ? `/app/mashq/s/${r.id}` : "/app?xato=vazifa");
}

export async function askAiRegrade(attemptId: string, questionId: number) {
  const { supabase, userId, profile } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success || !Number.isSafeInteger(questionId)) return { ok: false as const, message: "Noto'g'ri so'rov" };
  const { data: premium } = await supabase.rpc("is_premium");
  return aiRegrade(userId, Boolean(premium), attemptId, questionId, scriptOf(profile));
}

export async function askAiExplain(attemptId: string, questionId: number, question: string) {
  const { supabase, userId, profile } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success || !Number.isSafeInteger(questionId)) return { ok: false as const, message: "Noto'g'ri so'rov" };
  const { data: premium } = await supabase.rpc("is_premium");
  return aiExplain(userId, Boolean(premium), attemptId, questionId, String(question ?? "").slice(0, 500), scriptOf(profile));
}
