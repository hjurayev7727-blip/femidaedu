"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function approvePayment(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  // approve_payment ichida ham admin roli qayta tekshiriladi
  const { error } = await createSupabaseAdmin().rpc("approve_payment", { p_admin: userId, p_payment: id });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tolovlar");
}

export async function rejectPayment(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const reason = z.string().trim().min(3).max(500).catch("Chek tasdiqlanmadi").parse(form.get("reason"));
  const { error } = await createSupabaseAdmin().rpc("reject_payment", { p_admin: userId, p_payment: id, p_reason: reason });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/tolovlar");
}
