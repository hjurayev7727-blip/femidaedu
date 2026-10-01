"use server";
import type { ReportState } from "@/components/lawyers/report-form";
import { requireUser } from "@/lib/auth";
import { ReportSchema } from "@/lib/lawyers";
import { reportLawyer } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";

/** Yurist ustidan shikoyat */
export async function reportLawyerAction(form: FormData): Promise<ReportState> {
  const { userId, profile } = await requireUser();
  if (profile.role !== "admin" && !(await lawyersEnabled())) return { ok: false, message: "Bo'lim hozircha yopiq." };
  const p = ReportSchema.safeParse({ lawyer: form.get("lawyer"), kind: form.get("kind"), reason: form.get("reason") });
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Ma'lumotlarni tekshiring." };
  const r = await reportLawyer(userId, p.data.lawyer, p.data.kind, p.data.reason);
  return r.ok ? { ok: true, message: "Shikoyatingiz yuborildi. Admin ko'rib chiqadi — rahmat." } : { ok: false, message: r.message };
}
