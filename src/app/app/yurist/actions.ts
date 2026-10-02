"use server";
import { revalidatePath } from "next/cache";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { LawyerProfileSchema, LicenseSchema } from "@/lib/lawyers";
import { createLicenseUpload, saveLawyerProfile, submitVerification } from "@/lib/lawyers-server";

export type ProfileState = AiResult<true> | null;

export async function saveProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const { userId } = await requireUser();
  const p = LawyerProfileSchema.safeParse({
    display_name: form.get("display_name"),
    headline: form.get("headline"),
    bio: form.get("bio"),
    fields: form.getAll("fields"),
    region: form.get("region"),
    experience_years: form.get("experience_years"),
    languages: form.getAll("languages"),
    price_from_uzs: form.get("price_from_uzs"),
    phone: form.get("phone"),
    telegram: form.get("telegram"),
    payout_card: form.get("payout_card"),
    payout_holder: form.get("payout_holder"),
    hidden: form.get("hidden") === "on",
  });
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Forma noto'g'ri to'ldirilgan." };
  const r = await saveLawyerProfile(userId, p.data);
  if (r.ok) revalidatePath("/app/yurist");
  return r;
}

export async function startLicenseUpload(mime: unknown, size: unknown): Promise<AiResult<{ path: string; token: string }>> {
  const { userId } = await requireUser();
  if (typeof size !== "number" || size <= 0 || size > 5 * 1024 * 1024) return { ok: false, message: "Fayl 5 MB dan oshmasin." };
  return createLicenseUpload(userId, typeof mime === "string" ? mime : "");
}

export async function submitVerificationAction(license: unknown, path: unknown): Promise<AiResult<true>> {
  const { userId } = await requireUser();
  const l = LicenseSchema.safeParse(license);
  if (!l.success) return { ok: false, message: l.error.issues[0]?.message ?? "Guvohnoma raqamini yozing" };
  if (typeof path !== "string" || !path.startsWith(`${userId}/`)) return { ok: false, message: "Fayl topilmadi." };
  const r = await submitVerification(userId, l.data, path);
  if (r.ok) revalidatePath("/app/yurist");
  return r;
}
