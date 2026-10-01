import "server-only";
import { randomUUID } from "node:crypto";
import type { AiResult } from "@/lib/ai-server";
import type { LawyerCard, LawyerProfileInput } from "@/lib/lawyers";
import { DOC_EXT } from "@/lib/legal";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const LAWYER_DOCS_BUCKET = "lawyer-docs";

const REASON: Record<string, string> = {
  fields: "Sohalar noto'g'ri tanlangan.",
  blocked: "Profilingiz bloklangan. Savollar bo'lsa, qo'llab-quvvatlash xizmatiga yozing.",
  no_profile: "Avval yurist profilini to'ldiring.",
  already: "Profilingiz allaqachon tasdiqlangan.",
  pending: "Arizangiz ko'rib chiqilmoqda.",
  path: "Fayl topilmadi. Qayta yuklang.",
  self: "O'zingizga shikoyat qila olmaysiz.",
  limit: "Bugun juda ko'p shikoyat yubordingiz. Ertaga urinib ko'ring.",
  not_found: "Topilmadi.",
};
const fail = (r: { reason?: string } | null): AiResult<never> => ({ ok: false, message: REASON[r?.reason ?? ""] ?? "Saqlab bo'lmadi." });

export async function saveLawyerProfile(userId: string, p: LawyerProfileInput): Promise<AiResult<true>> {
  const { data, error } = await createSupabaseAdmin().rpc("upsert_lawyer_profile", { p_user: userId, p });
  const r = data as { ok: boolean; reason?: string } | null;
  return !error && r?.ok ? { ok: true, value: true } : fail(r);
}

export async function lawyerCatalog(opts: { field: string | null; region: string | null; q: string | null; page: number }, perPage = 20) {
  const { data } = await createSupabaseAdmin().rpc("lawyer_catalog", {
    p_field: opts.field, p_region: opts.region, p_q: opts.q, p_limit: perPage, p_offset: (opts.page - 1) * perPage,
  });
  return (data ?? { total: 0, items: [] }) as { total: number; items: LawyerCard[] };
}

export async function lawyerPublic(viewer: string, id: string) {
  const { data } = await createSupabaseAdmin().rpc("lawyer_public", { p_viewer: viewer, p_id: id });
  return (data ?? null) as (LawyerCard & { status: "active" | "hidden" | "blocked" }) | null;
}

export type MyLawyerProfile = Omit<LawyerCard, "id" | "verified" | "rating" | "has_contacts" | "since"> & {
  user_id: string; phone: string | null; telegram: string | null; payout_holder: string | null; payout_card_last4: string | null;
  verified_at: string | null; status: "active" | "hidden" | "blocked";
  verification: { status: "pending" | "approved" | "rejected"; reason: string | null; created_at: string } | null;
};

export async function myLawyerProfile(userId: string) {
  const { data } = await createSupabaseAdmin().rpc("my_lawyer_profile", { p_user: userId });
  return (data ?? null) as MyLawyerProfile | null;
}

/** Guvohnoma rasmi uchun imzolangan yuklash havolasi (yopiq bucket) */
export async function createLicenseUpload(userId: string, mime: string): Promise<AiResult<{ path: string; token: string }>> {
  const ext = DOC_EXT[mime];
  if (!ext) return { ok: false, message: "Faqat rasm (JPG, PNG, WEBP) yoki PDF." };
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { data, error } = await createSupabaseAdmin().storage.from(LAWYER_DOCS_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "Yuklashni boshlab bo'lmadi." };
  return { ok: true, value: { path, token: data.token } };
}

export async function submitVerification(userId: string, license: string, path: string): Promise<AiResult<true>> {
  const admin = createSupabaseAdmin();
  // Fayl haqiqatan yuklanganini tekshirish
  const dir = path.split("/")[0];
  const { data: files } = await admin.storage.from(LAWYER_DOCS_BUCKET).list(dir, { search: path.split("/")[1] });
  if (!files?.length) return fail({ reason: "path" });
  const { data } = await admin.rpc("submit_lawyer_verification", { p_user: userId, p_license: license, p_path: path });
  const r = data as { ok: boolean; reason?: string } | null;
  return r?.ok ? { ok: true, value: true } : fail(r);
}

export async function reportLawyer(userId: string, lawyerId: string, reason: string): Promise<AiResult<true>> {
  const { data } = await createSupabaseAdmin().rpc("report_lawyer", { p_user: userId, p_lawyer: lawyerId, p_reason: reason });
  const r = data as { ok: boolean; reason?: string } | null;
  return r?.ok ? { ok: true, value: true } : fail(r);
}

export async function licenseSignedUrl(path: string): Promise<string | null> {
  const { data } = await createSupabaseAdmin().storage.from(LAWYER_DOCS_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
