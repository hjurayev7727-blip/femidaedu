"use server";
// Faqat ishlab chiqish uchun: yuristlar sahifalarining namuna amallari (Supabase'siz)
import type { ReportState } from "@/components/lawyers/report-form";
import type { SaveLawyerState } from "@/components/lawyers/lawyer-form";
import { LawyerProfileSchema, lawyerFormInput, type Result } from "@/lib/lawyers";

const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("dev only");
};

export async function demoSaveLawyer(form: FormData): Promise<SaveLawyerState> {
  dev();
  const p = LawyerProfileSchema.safeParse(lawyerFormInput(form));
  return p.success ? { ok: true, message: "Namuna: saqlandi ✓" } : { ok: false, message: p.error.issues[0]?.message ?? "Xato" };
}

export async function demoReport(): Promise<ReportState> {
  dev();
  return { ok: true, message: "Namuna: shikoyat yuborildi." };
}

export async function demoUpload(): Promise<Result<{ path: string; token: string }>> {
  dev();
  return { ok: false, message: "Namuna sahifada fayl yuklanmaydi." };
}

export async function demoSubmit(): Promise<Result<null>> {
  dev();
  return { ok: false, message: "Namuna sahifada yuborilmaydi." };
}
