"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { reviewVerification } from "@/lib/lawyers-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const id = z.coerce.number().int().positive();

function done() {
  revalidatePath("/admin/yuristlar");
  revalidatePath("/app/yuristlar");
}

// Har bir RPC ichida ham admin roli qayta tekshiriladi
async function rpc(fn: string, args: Record<string, unknown>) {
  const { data, error } = await createSupabaseAdmin().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as { ok: boolean; reason?: string };
}

export async function approveVerification(form: FormData) {
  const { userId } = await requireRole("admin");
  await reviewVerification(userId, id.parse(form.get("id")), true, null);
  done();
}

export async function rejectVerification(form: FormData) {
  const { userId } = await requireRole("admin");
  const reason = z.string().trim().min(3).max(500).catch("Hujjat tasdiqlanmadi").parse(form.get("reason"));
  await reviewVerification(userId, id.parse(form.get("id")), false, reason);
  done();
}

export async function handleReport(form: FormData) {
  const { userId } = await requireRole("admin");
  const status = z.enum(["resolved", "dismissed"]).parse(form.get("status"));
  await rpc("handle_lawyer_report", { p_admin: userId, p_id: id.parse(form.get("id")), p_status: status });
  done();
}

export async function setLawyerStatus(form: FormData) {
  const { userId } = await requireRole("admin");
  const status = z.enum(["active", "hidden", "blocked"]).parse(form.get("status"));
  await rpc("set_lawyer_status", { p_admin: userId, p_lawyer: z.uuid().parse(form.get("lawyer")), p_status: status });
  done();
}

export async function revokeVerification(form: FormData) {
  const { userId } = await requireRole("admin");
  await rpc("revoke_lawyer_verification", { p_admin: userId, p_lawyer: z.uuid().parse(form.get("lawyer")) });
  done();
}
