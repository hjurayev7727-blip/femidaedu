"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { DisputeSchema, ReviewSchema } from "@/lib/escrow";
import { createServiceOrder, lawyerPaymentsEnabled, simpleRpc, submitServiceReceipt } from "@/lib/escrow-server";
import { paymeCheckoutUrl, paymeEnv } from "@/lib/payme";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const idOf = (v: unknown) => z.coerce.number().int().positive().safeParse(v);
export type FormState = AiResult<true> | null;

/** Suhbatdagi taklif kartasidan: "Qabul qilish va to'lash" */
export async function acceptOffer(form: FormData) {
  const { userId } = await requireUser();
  const offer = idOf(form.get("offer"));
  if (!offer.success || !(await lawyerPaymentsEnabled())) redirect("/app/suhbatlar");
  const r = await createServiceOrder(userId, offer.data);
  redirect(r.ok ? `/app/buyurtmalar/${r.value}` : `/app/suhbatlar?xato=${encodeURIComponent(r.message)}`);
}

export async function payWithPayme(form: FormData) {
  const { userId } = await requireUser();
  const id = idOf(form.get("order"));
  const cfg = paymeEnv();
  if (!id.success) redirect("/app/buyurtmalar");
  if (!cfg) redirect(`/app/buyurtmalar/${id.data}?xato=${encodeURIComponent("Payme hozircha ulanmagan. Karta orqali to'lang.")}`);
  const { data } = await createSupabaseAdmin().rpc("create_service_payme_order", { p_user: userId, p_order: id.data });
  const r = data as { ok: boolean; code?: string; amount_uzs?: number } | null;
  if (!r?.ok || !r.code || !r.amount_uzs) redirect(`/app/buyurtmalar/${id.data}?xato=${encodeURIComponent("To'lovni boshlab bo'lmadi.")}`);
  redirect(paymeCheckoutUrl(cfg, { code: r.code, amountUzs: r.amount_uzs }, `${env().NEXT_PUBLIC_SITE_URL}/app/buyurtmalar/${id.data}?payme=1`));
}

export async function uploadReceipt(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = idOf(form.get("order"));
  if (!id.success) return { ok: false, message: "Buyurtma topilmadi." };
  const r = await submitServiceReceipt(userId, id.data, form.get("receipt"));
  if (r.ok) revalidatePath(`/app/buyurtmalar/${id.data}`);
  return r;
}

async function simple(fn: string, form: FormData, extra: (userId: string, id: number) => Record<string, unknown>) {
  const { userId } = await requireUser();
  const id = idOf(form.get("order"));
  if (!id.success) redirect("/app/buyurtmalar");
  const r = await simpleRpc(fn, extra(userId, id.data));
  redirect(`/app/buyurtmalar/${id.data}${r.ok ? "" : `?xato=${encodeURIComponent(r.message)}`}`);
}

export async function cancelOrder(form: FormData) {
  await simple("cancel_service_order", form, (u, id) => ({ p_user: u, p_order: id }));
}
export async function confirmOrder(form: FormData) {
  await simple("confirm_order", form, (u, id) => ({ p_user: u, p_order: id }));
}
export async function markDelivered(form: FormData) {
  await simple("mark_delivered", form, (u, id) => ({ p_lawyer: u, p_order: id }));
}

export async function openDispute(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = idOf(form.get("order"));
  const reason = DisputeSchema.safeParse(form.get("reason"));
  if (!id.success) return { ok: false, message: "Buyurtma topilmadi." };
  if (!reason.success) return { ok: false, message: reason.error.issues[0]?.message ?? "Sababni yozing" };
  const r = await simpleRpc("open_dispute", { p_user: userId, p_order: id.data, p_reason: reason.data });
  if (r.ok) revalidatePath(`/app/buyurtmalar/${id.data}`);
  return r;
}

export async function leaveReview(_prev: FormState, form: FormData): Promise<FormState> {
  const { userId } = await requireUser();
  const id = idOf(form.get("order"));
  const v = ReviewSchema.safeParse({ rating: form.get("rating"), body: form.get("body") ?? "" });
  if (!id.success) return { ok: false, message: "Buyurtma topilmadi." };
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Bahoni tanlang" };
  const r = await simpleRpc("leave_review", { p_user: userId, p_order: id.data, p_rating: v.data.rating, p_body: v.data.body });
  if (r.ok) revalidatePath(`/app/buyurtmalar/${id.data}`);
  return r;
}
