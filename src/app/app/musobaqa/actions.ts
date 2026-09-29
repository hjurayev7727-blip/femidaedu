"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { finishContestAttempt } from "@/lib/contest-server";
import { saveMockAnswer } from "@/lib/mock-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function joinContest(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = z.coerce.number().int().positive().safeParse(form.get("id"));
  if (!id.success) redirect("/app/musobaqa");
  const { data: premium } = await supabase.rpc("is_premium");
  const { data } = await createSupabaseAdmin().rpc("start_contest", { p_user: userId, p_contest: id.data, p_premium: Boolean(premium) });
  const r = data as { ok: boolean; reason?: string } | null;
  redirect(r?.ok ? `/app/musobaqa/${id.data}` : `/app/musobaqa/${id.data}?xato=${r?.reason ?? "server"}`);
}

export async function saveContestAnswer(attemptId: string, questionId: number, response: unknown) {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success || !Number.isSafeInteger(questionId)) return { ok: false, reason: "invalid" };
  // save_mock_answer egalik, muddat va savol tegishliligini tekshiradi (mock va contest rejimlari)
  return saveMockAnswer(userId, attemptId, questionId, response);
}

export async function finishContest(attemptId: string) {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success) redirect("/app/musobaqa");
  const admin = createSupabaseAdmin();
  const { data: entry } = await admin.from("contest_entries").select("contest_id").eq("attempt_id", attemptId).eq("user_id", userId)
    .maybeSingle<{ contest_id: number }>();
  if (!entry) redirect("/app/musobaqa");
  await finishContestAttempt(attemptId);
  redirect(`/app/musobaqa/${entry.contest_id}`);
}
