"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { submitManualPayment } from "@/lib/payments";
import { paymeCheckoutUrl, paymeEnv } from "@/lib/payme";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type PayState = { ok: boolean; message: string } | null;

export async function payManually(_prev: PayState, form: FormData): Promise<PayState> {
  const { userId } = await requireUser();
  const plan = z.string().regex(/^[a-z0-9_-]{1,32}$/).safeParse(form.get("plan"));
  if (!plan.success) return { ok: false, message: "Tarifni tanlang" };
  const r = await submitManualPayment(userId, plan.data, form.get("receipt"));
  if (!r.ok) return r;
  revalidatePath("/app/premium");
  return { ok: true, message: "Chek qabul qilindi! Tekshirilgach Premium avtomatik yoqiladi." };
}

/** Payme: buyurtma yaratib, Payme to'lov sahifasiga yo'naltiradi. */
export async function payWithPayme(form: FormData) {
  const { userId } = await requireUser();
  const cfg = paymeEnv();
  const plan = z.string().regex(/^[a-z0-9_-]{1,32}$/).safeParse(form.get("plan"));
  if (!cfg || !plan.success) redirect("/app/premium?payme=xato");

  const { data, error } = await createSupabaseAdmin().rpc("create_payme_order", { p_user: userId, p_plan: plan.data });
  const r = data as { ok: boolean; code?: string; amount_uzs?: number } | null;
  if (error || !r?.ok || !r.code || !r.amount_uzs) {
    console.error("create_payme_order", error?.message ?? r);
    redirect("/app/premium?payme=xato");
  }
  const back = `${env().NEXT_PUBLIC_SITE_URL}/app/premium?payme=${r.code}`;
  redirect(paymeCheckoutUrl(cfg, { code: r.code, amountUzs: r.amount_uzs }, back));
}
