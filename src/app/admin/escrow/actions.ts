"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { CommissionSchema } from "@/lib/escrow";
import { RECEIPT_BUCKET } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/server";

// Har bir RPC ichida admin roli qayta tekshiriladi (is_admin)
const done = () => revalidatePath("/admin/escrow");

export async function reviewReceipt(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const approve = form.get("decision") === "approve";
  const note = z.string().trim().max(300).catch("").parse(form.get("note"));
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("review_service_receipt", { p_admin: userId, p_order: id, p_approve: approve, p_note: note || null });
  const r = data as { ok: boolean; receipt_path?: string } | null;
  if (r?.ok && !approve && r.receipt_path) await admin.storage.from(RECEIPT_BUCKET).remove([r.receipt_path]);
  done();
}

export async function resolveDispute(form: FormData) {
  const { userId } = await requireRole("admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const resolution = z.enum(["release", "refund"]).parse(form.get("resolution"));
  const note = z.string().trim().max(1000).catch("").parse(form.get("note"));
  await createSupabaseAdmin().rpc("resolve_dispute", { p_admin: userId, p_order: id, p_resolution: resolution, p_note: note || null });
  done();
}

export async function recordPayout(form: FormData) {
  const { userId } = await requireRole("admin");
  const lawyer = z.uuid().parse(form.get("lawyer"));
  const orders = z.array(z.coerce.number().int().positive()).min(1).parse(String(form.get("orders") ?? "").split(",").filter(Boolean));
  const reference = z.string().trim().min(3).max(200).parse(form.get("reference"));
  await createSupabaseAdmin().rpc("record_payout", { p_admin: userId, p_lawyer: lawyer, p_orders: orders, p_reference: reference });
  done();
}

export type SettingsState = { ok: boolean; message: string } | null;

export async function saveEscrowSettings(_prev: SettingsState, form: FormData): Promise<SettingsState> {
  const { userId } = await requireRole("admin");
  const pct = CommissionSchema.safeParse(form.get("pct"));
  if (!pct.success) return { ok: false, message: pct.error.issues[0]?.message ?? "Komissiya noto'g'ri" };
  const now = new Date().toISOString();
  const { error } = await createSupabaseAdmin().from("app_settings").upsert([
    { key: "lawyer_commission_pct", value: pct.data, updated_at: now, updated_by: userId },
    { key: "lawyer_payments_enabled", value: form.get("enabled") === "on", updated_at: now, updated_by: userId },
  ]);
  if (error) return { ok: false, message: "Saqlab bo'lmadi" };
  done();
  return { ok: true, message: "Saqlandi" };
}
