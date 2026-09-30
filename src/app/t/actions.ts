"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ResponseSchema } from "@/lib/practice";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { normalizeCode, SHARE_CODE_RE, START_ERRORS } from "@/lib/user-tests";
import { answerTestItem, currentActor, ensureGuest, finishTestAttempt, type TestAnswerResult } from "@/lib/user-tests-server";

export type StartState = { message: string } | null;

/** Testni boshlash: kirgan foydalanuvchi yoki mehmon (ism + httpOnly token) */
export async function startTest(_prev: StartState, form: FormData): Promise<StartState> {
  const code = normalizeCode(String(form.get("code") ?? ""));
  if (!SHARE_CODE_RE.test(code)) return { message: START_ERRORS.not_found };
  const actor = await currentActor();
  let guestName: string | null = null;
  let guest: string | null = null;
  if (!actor.userId) {
    const name = z.string().trim().min(2).max(60).safeParse(form.get("name"));
    if (!name.success) return { message: "Ism-familiyangizni yozing (muallifga natija bilan ko'rinadi)." };
    guestName = name.data;
    guest = await ensureGuest();
  }
  const { data } = await createSupabaseAdmin().rpc("start_test_attempt", { p_code: code, p_user: actor.userId, p_guest_name: guestName, p_guest: guest });
  const r = data as { ok: boolean; attempt_id?: string; reason?: string } | null;
  if (!r?.ok || !r.attempt_id) return { message: START_ERRORS[r?.reason ?? ""] ?? "Testni boshlab bo'lmadi." };
  redirect(`/t/${code}/${r.attempt_id}`);
}

export async function answerItem(attemptId: string, itemId: number, response: unknown): Promise<TestAnswerResult> {
  const a = z.uuid().safeParse(attemptId);
  const r = ResponseSchema.safeParse(response);
  if (!a.success || !r.success || !Number.isSafeInteger(itemId)) return { ok: false, message: "Javob noto'g'ri shaklda." };
  return answerTestItem(a.data, itemId, r.data);
}

export async function finishTest(code: string, attemptId: string) {
  if (!z.uuid().safeParse(attemptId).success || !SHARE_CODE_RE.test(code)) redirect("/t");
  await finishTestAttempt(attemptId);
  redirect(`/t/${code}/${attemptId}/natija`);
}

export async function rateTest(form: FormData) {
  const actor = await currentActor();
  const p = z.object({ test: z.coerce.number().int().positive(), stars: z.coerce.number().int().min(1).max(5), back: z.string().regex(/^\/t\/[A-Z0-9]{6}\/[0-9a-f-]{36}\/natija$/) })
    .safeParse({ test: form.get("test"), stars: form.get("stars"), back: form.get("back") });
  if (!actor.userId || !p.success) return;
  await createSupabaseAdmin().rpc("rate_test", { p_user: actor.userId, p_test: p.data.test, p_stars: p.data.stars });
  revalidatePath(p.data.back);
}

export async function openCode(form: FormData) {
  const code = normalizeCode(String(form.get("code") ?? ""));
  redirect(SHARE_CODE_RE.test(code) ? `/t/${code}` : "/t?xato=kod");
}
