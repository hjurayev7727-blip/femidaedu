"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { LAWYER_DOCS_BUCKET } from "@/lib/lawyers-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Har bir RPC ichida admin roli qayta tekshiriladi (is_admin)
export async function reviewVerification(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const approve = form.get("decision") === "approve";
  const reason = z.string().trim().max(500).catch("").parse(form.get("reason"));
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("review_lawyer_verification", { p_admin: userId, p_id: id, p_approve: approve, p_reason: reason || null });
  // Ko'rib chiqilgan hujjat (tasdiqlangan ham, rad etilgan ham) saqlanmaydi — shaxsga doir ma'lumot; raqam bazada qoladi
  const r = data as { ok: boolean; doc_path?: string } | null;
  if (r?.ok && r.doc_path) await admin.storage.from(LAWYER_DOCS_BUCKET).remove([r.doc_path]);
  revalidatePath("/admin/yuristlar");
}

export async function handleReport(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const status = z.enum(["resolved", "dismissed"]).parse(form.get("status"));
  await createSupabaseAdmin().rpc("handle_lawyer_report", { p_admin: userId, p_id: id, p_status: status });
  revalidatePath("/admin/yuristlar");
}

export async function setLawyerStatus(form: FormData) {
  const { userId } = await requireRole("admin");
  const lawyer = z.uuid().parse(form.get("lawyer"));
  const status = z.enum(["active", "blocked"]).parse(form.get("status"));
  await createSupabaseAdmin().rpc("set_lawyer_status", { p_admin: userId, p_lawyer: lawyer, p_status: status });
  revalidatePath("/admin/yuristlar");
}

export async function toggleLawyers(form: FormData) {
  const { userId } = await requireRole("admin");
  const on = form.get("on") === "1";
  await createSupabaseAdmin().from("app_settings")
    .upsert({ key: "lawyers_enabled", value: on, updated_at: new Date().toISOString(), updated_by: userId });
  revalidatePath("/admin/yuristlar");
  revalidatePath("/app", "layout");
}

export async function assignRequest(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const lawyer = z.uuid().safeParse(String(form.get("lawyer") ?? "").trim());
  if (!lawyer.success) return;
  await createSupabaseAdmin().rpc("assign_request", { p_admin: userId, p_request: id, p_lawyer: lawyer.data });
  revalidatePath("/admin/yuristlar");
}
