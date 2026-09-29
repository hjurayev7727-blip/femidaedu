"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { submitManualPayment } from "@/lib/payments";

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
