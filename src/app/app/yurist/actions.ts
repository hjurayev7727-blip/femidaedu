"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SaveLawyerState } from "@/components/lawyers/lawyer-form";
import { requireUser } from "@/lib/auth";
import { LawyerProfileSchema, lawyerFormInput, LICENSE_MAX_BYTES, LicenseSchema, type Result } from "@/lib/lawyers";
import { createLicenseUpload, saveLawyerProfile, submitLicense } from "@/lib/lawyers-server";
import { UploadRequestSchema } from "@/lib/legal";

/** Ro'yxatdan o'tish yoki profilni saqlash */
export async function saveLawyerAction(form: FormData): Promise<SaveLawyerState> {
  const { userId } = await requireUser();
  const p = LawyerProfileSchema.safeParse(lawyerFormInput(form));
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring." };
  const r = await saveLawyerProfile(userId, p.data);
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/app/yurist");
  revalidatePath("/app/yuristlar");
  if (r.value.created) return { ok: true, message: "Profilingiz yaratildi ✓" };
  return { ok: true, message: r.value.unverified ? "Saqlandi. Ism yoki tur o'zgargani uchun belgi olindi — hujjatni qayta yuboring." : "Saqlandi ✓" };
}

/** Guvohnoma uchun bir martalik yuklash havolasi */
export async function createLicenseUploadAction(file: unknown): Promise<Result<{ path: string; token: string }>> {
  const { userId } = await requireUser();
  const f = UploadRequestSchema.safeParse(file);
  if (!f.success) return { ok: false, message: f.error.issues[0]?.message ?? "Fayl noto'g'ri." };
  if (f.data.size > LICENSE_MAX_BYTES) return { ok: false, message: "Fayl 5 MB dan katta" };
  return createLicenseUpload(userId, f.data.mime);
}

const SubmitSchema = z.object({ license: LicenseSchema, path: z.string().max(200) });

/** Yuklangan guvohnomani admin tekshiruviga yuborish */
export async function submitLicenseAction(input: unknown): Promise<Result<null>> {
  const { userId } = await requireUser();
  const s = SubmitSchema.safeParse(input);
  if (!s.success) return { ok: false, message: s.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring." };
  const r = await submitLicense(userId, s.data.license, s.data.path);
  if (r.ok) revalidatePath("/app/yurist");
  return r;
}
