"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { finishMock, saveMockAnswer, startMock } from "@/lib/mock-server";

export async function startMockExam() {
  const { supabase, userId } = await requireUser();
  const { data: premium } = await supabase.rpc("is_premium");
  const r = await startMock(userId, Boolean(premium));
  if (!r.ok) redirect(`/app/imtihon?xato=${r.reason}`);
  redirect(`/app/imtihon/${r.id}`);
}

export async function saveAnswer(attemptId: string, questionId: number, response: unknown) {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success || !Number.isSafeInteger(questionId)) return { ok: false, reason: "invalid" };
  return saveMockAnswer(userId, attemptId, questionId, response);
}

export async function finishMockExam(attemptId: string) {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(attemptId).success) redirect("/app/imtihon");
  const r = await finishMock(userId, attemptId);
  redirect(r.ok ? `/app/imtihon/${attemptId}/natija` : "/app/imtihon");
}
