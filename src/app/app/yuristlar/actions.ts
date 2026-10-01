"use server";
import { z } from "zod";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { ReportSchema } from "@/lib/lawyers";
import { reportLawyer } from "@/lib/lawyers-server";

export type ReportState = AiResult<true> | null;

export async function reportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const { userId } = await requireUser();
  const id = z.uuid().safeParse(form.get("lawyer"));
  const reason = ReportSchema.safeParse(form.get("reason"));
  if (!id.success) return { ok: false, message: "Yurist topilmadi." };
  if (!reason.success) return { ok: false, message: reason.error.issues[0]?.message ?? "Shikoyatni yozing" };
  return reportLawyer(userId, id.data, reason.data);
}
