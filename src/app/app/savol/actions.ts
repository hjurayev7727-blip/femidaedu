"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { DocQuestionSchema, LegalQuestionSchema, safeDocName } from "@/lib/legal";
import { analyzeLegalDocument, askLegal, createDocUpload, type DocReply, type LegalReply } from "@/lib/legal-server";

async function premiumOf(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data } = await supabase.rpc("is_premium");
  return Boolean(data);
}

/** Huquqiy savol (yangi yoki davomli suhbat) */
export async function askLegalAction(threadId: string | null, question: unknown): Promise<AiResult<LegalReply>> {
  const { supabase, userId } = await requireUser();
  const q = LegalQuestionSchema.safeParse(question);
  if (!q.success) return { ok: false, message: q.error.issues[0]?.message ?? "Savolni yozing" };
  if (threadId !== null && !z.uuid().safeParse(threadId).success) return { ok: false, message: "So'rov noto'g'ri." };
  const r = await askLegal(userId, await premiumOf(supabase), { threadId, question: q.data });
  if (r.ok) revalidatePath("/app/savol");
  return r;
}

/** Hujjat yuklash uchun imzolangan havola */
export async function startDocUpload(mime: unknown, size: unknown): Promise<AiResult<{ path: string; token: string }>> {
  const { userId } = await requireUser();
  const s = z.number().int().positive().max(10 * 1024 * 1024).safeParse(size);
  if (!s.success) return { ok: false, message: "Fayl 10 MB dan oshmasin." };
  return createDocUpload(userId, typeof mime === "string" ? mime : "");
}

/** Yuklangan hujjatni tahlil qilish */
export async function analyzeDocAction(path: unknown, name: unknown, question: unknown): Promise<AiResult<DocReply>> {
  const { supabase, userId } = await requireUser();
  const q = DocQuestionSchema.safeParse(question ?? "");
  if (!q.success) return { ok: false, message: q.error.issues[0]?.message ?? "Savol noto'g'ri" };
  if (typeof path !== "string") return { ok: false, message: "Fayl topilmadi." };
  const r = await analyzeLegalDocument(userId, await premiumOf(supabase), { path, name: safeDocName(name), question: q.data });
  if (r.ok) revalidatePath("/app/savol");
  return r;
}
