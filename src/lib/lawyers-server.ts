import "server-only";
import { randomUUID } from "node:crypto";
import { DOC_EXT, sniffFile, UPLOAD_TTL_MS, uploadPathRe, UPLOADS_PER_HOUR, type DocMime } from "@/lib/legal";
import {
  CATALOG_PAGE, LAWYER_DOCS_BUCKET, LICENSE_MAX_BYTES, type LawyerKind, type LawyerProfileInput, type ReportKind, type Result,
} from "@/lib/lawyers";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Katalog kartasi va ochiq profil — kontaktlarsiz (RPC ularni qaytarmaydi) */
export type LawyerCard = {
  id: string;
  kind: LawyerKind;
  display_name: string;
  headline: string;
  fields: string[];
  region: string;
  experience_years: number;
  languages: string[];
  price_from_uzs: number | null;
  verified: boolean;
  rating: number | null;
  rating_count: number;
};
export type LawyerPublic = LawyerCard & { bio: string; created_at: string };

/** Yuristning o'z kabineti uchun (kontaktlar bilan) */
export type MyLawyer = Omit<LawyerPublic, "id" | "verified"> & {
  user_id: string;
  phone: string | null;
  telegram: string | null;
  status: "active" | "hidden" | "blocked";
  verified_at: string | null;
};
export type MyVerification = { id: number; license_no: string; status: "pending" | "approved" | "rejected"; reason: string | null; created_at: string };

const num = (v: unknown) => (v == null ? null : Number(v));
const card = <T extends { rating: unknown }>(r: T) => ({ ...r, rating: num(r.rating) });

export async function lawyerCatalog(f: { field: string | null; region: string | null; q: string | null; page: number }): Promise<{ items: LawyerCard[]; more: boolean }> {
  const { data, error } = await createSupabaseAdmin().rpc("lawyer_catalog", {
    p_field: f.field, p_region: f.region, p_q: f.q, p_limit: CATALOG_PAGE + 1, p_offset: f.page * CATALOG_PAGE,
  });
  if (error) console.error("lawyer_catalog", error.message);
  const rows = ((data ?? []) as LawyerCard[]).map(card);
  return { items: rows.slice(0, CATALOG_PAGE), more: rows.length > CATALOG_PAGE };
}

export async function lawyerPublic(id: string): Promise<LawyerPublic | null> {
  const { data } = await createSupabaseAdmin().rpc("lawyer_public", { p_id: id });
  const r = (data as (Omit<LawyerPublic, "verified"> & { verified_at: string | null })[] | null)?.[0];
  if (!r) return null;
  const { verified_at, ...rest } = card(r);
  return { ...rest, verified: verified_at !== null };
}

/** Egasi o'z (yashirin) profilini oldindan ko'rishi uchun: faqat ochiq maydonlar */
export function ownPreview(me: MyLawyer): LawyerPublic {
  return {
    id: me.user_id, kind: me.kind, display_name: me.display_name, headline: me.headline, bio: me.bio, fields: me.fields, region: me.region,
    experience_years: me.experience_years, languages: me.languages, price_from_uzs: me.price_from_uzs, verified: me.verified_at !== null,
    rating: me.rating, rating_count: me.rating_count, created_at: me.created_at,
  };
}

export async function myLawyer(userId: string): Promise<{ profile: MyLawyer | null; verification: MyVerification | null }> {
  const admin = createSupabaseAdmin();
  const [{ data: profile }, { data: verification }] = await Promise.all([
    admin.from("lawyer_profiles")
      .select("user_id, kind, display_name, headline, bio, fields, region, experience_years, languages, price_from_uzs, phone, telegram, status, verified_at, rating_sum, rating_count, created_at")
      .eq("user_id", userId).maybeSingle<Omit<MyLawyer, "rating"> & { rating_sum: number }>(),
    admin.from("lawyer_verifications").select("id, license_no, status, reason, created_at").eq("user_id", userId)
      .order("id", { ascending: false }).limit(1).maybeSingle<MyVerification>(),
  ]);
  if (!profile) return { profile: null, verification: verification ?? null };
  const { rating_sum, ...rest } = profile;
  return { profile: { ...rest, rating: rest.rating_count ? Math.round((rating_sum / rest.rating_count) * 10) / 10 : null }, verification: verification ?? null };
}

const SAVE_ERROR: Record<string, string> = {
  fields: "Sohalarni qayta tanlang.",
  contact: "Telefon yoki Telegram'dan kamida bittasini kiriting.",
  blocked: "Profilingiz bloklangan. Savol bo'lsa, qo'llab-quvvatlash xizmatiga yozing.",
  invalid: "Ma'lumotlarni tekshiring.",
  not_found: "Profil topilmadi.",
};

export async function saveLawyerProfile(userId: string, p: LawyerProfileInput): Promise<Result<{ created: boolean; unverified: boolean }>> {
  const { data, error } = await createSupabaseAdmin().rpc("upsert_lawyer_profile", { p_user: userId, p });
  const r = data as { ok: boolean; reason?: string; created?: boolean; unverified?: boolean } | null;
  if (error || !r?.ok) {
    if (error) console.error("upsert_lawyer_profile", error.message);
    return { ok: false, message: SAVE_ERROR[r?.reason ?? ""] ?? "Serverda xatolik. Qayta urinib ko'ring." };
  }
  return { ok: true, value: { created: Boolean(r.created), unverified: Boolean(r.unverified) } };
}

async function removeLicenseUpload(path: string) {
  const admin = createSupabaseAdmin();
  await admin.storage.from(LAWYER_DOCS_BUCKET).remove([path]);
  await admin.from("legal_uploads").delete().eq("path", path);
}

/** Guvohnoma rasmi uchun bir martalik yuklash havolasi (fayl server action orqali o'tmaydi — Vercel tana chegarasi) */
export async function createLicenseUpload(userId: string, mime: DocMime): Promise<Result<{ path: string; token: string }>> {
  const admin = createSupabaseAdmin();
  const [{ data: l }, { count: pending }, { count: recent }] = await Promise.all([
    admin.from("lawyer_profiles").select("status, verified_at").eq("user_id", userId).maybeSingle<{ status: string; verified_at: string | null }>(),
    admin.from("lawyer_verifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "pending"),
    admin.from("legal_uploads").select("path", { count: "exact", head: true }).eq("user_id", userId).eq("bucket", LAWYER_DOCS_BUCKET)
      .gte("created_at", new Date(Date.now() - UPLOAD_TTL_MS).toISOString()),
  ]);
  if (!l) return { ok: false, message: "Avval yurist profilini to'ldiring." };
  if (l.status === "blocked") return { ok: false, message: SAVE_ERROR.blocked };
  if (l.verified_at) return { ok: false, message: "Profilingiz allaqachon tasdiqlangan." };
  if (pending) return { ok: false, message: "Oldingi hujjatingiz hali ko'rib chiqilmoqda." };
  if ((recent ?? 0) >= UPLOADS_PER_HOUR) return { ok: false, message: "Juda ko'p yuklash. Birozdan keyin urinib ko'ring." };

  const path = `${userId}/${randomUUID()}.${DOC_EXT[mime]}`;
  const { error } = await admin.from("legal_uploads").insert({ path, user_id: userId, bucket: LAWYER_DOCS_BUCKET });
  if (error) return { ok: false, message: "Serverda xatolik. Qayta urinib ko'ring." };
  const { data, error: e2 } = await admin.storage.from(LAWYER_DOCS_BUCKET).createSignedUploadUrl(path);
  if (e2 || !data) {
    await admin.from("legal_uploads").delete().eq("path", path);
    console.error("license upload url", e2?.message);
    return { ok: false, message: "Yuklash havolasini olib bo'lmadi." };
  }
  return { ok: true, value: { path, token: data.token } };
}

const SUBMIT_ERROR: Record<string, string> = {
  no_profile: "Avval yurist profilini to'ldiring.",
  blocked: SAVE_ERROR.blocked,
  already: "Profilingiz allaqachon tasdiqlangan.",
  pending: "Oldingi hujjatingiz hali ko'rib chiqilmoqda.",
  too_many: "Bu hafta juda ko'p urinish bo'ldi. Bir haftadan keyin qayta yuboring.",
  path: "Fayl topilmadi. Qayta yuklang.",
  invalid: "Guvohnoma raqamini tekshiring.",
};

/** Yuklangan guvohnomani tekshirib, admin navbatiga qo'yish. Xato bo'lsa fayl darhol o'chiriladi. */
export async function submitLicense(userId: string, license: string, path: string): Promise<Result<null>> {
  if (!uploadPathRe(userId).test(path)) return { ok: false, message: SUBMIT_ERROR.path };
  const admin = createSupabaseAdmin();
  const { data: issued } = await admin.from("legal_uploads").select("path").eq("path", path).eq("user_id", userId).eq("bucket", LAWYER_DOCS_BUCKET).maybeSingle();
  if (!issued) return { ok: false, message: SUBMIT_ERROR.path };

  const { data: blob } = await admin.storage.from(LAWYER_DOCS_BUCKET).download(path);
  const sniff = blob ? sniffFile(new Uint8Array(await blob.arrayBuffer()), LICENSE_MAX_BYTES) : { ok: false as const, message: "Fayl yuklanmagan. Qayta urinib ko'ring." };
  if (!sniff.ok) {
    await removeLicenseUpload(path);
    return { ok: false, message: sniff.message };
  }
  const { data, error } = await admin.rpc("submit_lawyer_verification", { p_user: userId, p_license: license, p_path: path });
  const r = data as { ok: boolean; reason?: string } | null;
  if (error || !r?.ok) {
    await removeLicenseUpload(path);
    if (error) console.error("submit_lawyer_verification", error.message);
    return { ok: false, message: SUBMIT_ERROR[r?.reason ?? ""] ?? "Serverda xatolik. Qayta urinib ko'ring." };
  }
  await admin.from("legal_uploads").delete().eq("path", path); // fayl endi tasdiqlash arizasiga tegishli
  return { ok: true, value: null };
}

/** Admin uchun guvohnomani ko'rish havolasi (10 daqiqa) */
export async function licenseSignedUrl(path: string): Promise<string | null> {
  const { data } = await createSupabaseAdmin().storage.from(LAWYER_DOCS_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Admin: tasdiqlash yoki rad etish; ko'rib chiqilgan guvohnoma fayli o'chiriladi (raqam qoladi) */
export async function reviewVerification(adminId: string, id: number, approve: boolean, reason: string | null): Promise<void> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("review_lawyer_verification", { p_admin: adminId, p_id: id, p_approve: approve, p_reason: reason });
  if (error) throw new Error(error.message);
  const r = data as { ok: boolean; path?: string | null };
  if (r.ok && r.path) await admin.storage.from(LAWYER_DOCS_BUCKET).remove([r.path]);
}

const REPORT_ERROR: Record<string, string> = {
  self: "O'zingiz ustidan shikoyat qilib bo'lmaydi.",
  not_found: "Yurist topilmadi.",
  duplicate: "Bu yurist ustidan shikoyatingiz allaqachon ko'rib chiqilmoqda.",
  limit: "Bugun juda ko'p shikoyat yubordingiz. Ertaga urinib ko'ring.",
  invalid: "Sabab va izohni tekshiring.",
};

export async function reportLawyer(userId: string, lawyerId: string, kind: ReportKind, reason: string): Promise<Result<null>> {
  const { data, error } = await createSupabaseAdmin().rpc("report_lawyer", { p_user: userId, p_lawyer: lawyerId, p_kind: kind, p_reason: reason });
  const r = data as { ok: boolean; reason?: string } | null;
  if (error || !r?.ok) {
    if (error) console.error("report_lawyer", error.message);
    return { ok: false, message: REPORT_ERROR[r?.reason ?? ""] ?? "Serverda xatolik. Qayta urinib ko'ring." };
  }
  return { ok: true, value: null };
}

export async function hasLawyerProfile(userId: string): Promise<boolean> {
  const { count } = await createSupabaseAdmin().from("lawyer_profiles").select("user_id", { count: "exact", head: true }).eq("user_id", userId);
  return Boolean(count);
}

/** Sohalar ro'yxati (filtr va forma uchun) */
export async function fieldOptions(): Promise<{ slug: string; title: string; icon: string }[]> {
  const { data } = await createSupabaseAdmin().from("fields").select("slug, title, icon").order("sort").returns<{ slug: string; title: string; icon: string }[]>();
  return data ?? [];
}
