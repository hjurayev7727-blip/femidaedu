"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { UploadRequestSchema } from "@/lib/legal";
import { analyzeLegalDocument, askLegal, createLegalUpload, type LegalReply } from "@/lib/legal-server";
import { QuestionSchema } from "@/lib/tutor";

async function premiumOf(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data } = await supabase.rpc("is_premium");
  return Boolean(data);
}

/** Huquqiy savol (yangi suhbat yoki davomi) */
export async function askLegalAction(threadId: string | null, question: unknown): Promise<AiResult<LegalReply>> {
  const { supabase, userId } = await requireUser();
  const q = QuestionSchema.safeParse(question);
  if (!q.success) return { ok: false, message: q.error.issues[0]?.message ?? "Savolni yozing" };
  if (threadId !== null && !z.uuid().safeParse(threadId).success) return { ok: false, message: "So'rov noto'g'ri." };
  const r = await askLegal(userId, await premiumOf(supabase), { threadId, question: q.data });
  if (r.ok) revalidatePath("/app/savol");
  return r;
}

/** Hujjat yuklash uchun bir martalik havola (fayl server action orqali o'tmaydi) */
export async function createUploadAction(file: unknown): Promise<AiResult<{ path: string; token: string }>> {
  const { supabase, userId } = await requireUser();
  const f = UploadRequestSchema.safeParse(file);
  if (!f.success) return { ok: false, message: f.error.issues[0]?.message ?? "Fayl noto'g'ri." };
  return createLegalUpload(userId, await premiumOf(supabase), f.data.mime);
}

const AnalyzeSchema = z.object({
  path: z.string().max(200),
  question: z.string().trim().max(2000, "Savol 2000 belgidan oshmasin").default(""),
  name: z.string().max(300).default(""),
});

/** Yuklangan hujjatni tahlil qilish; fayl tahlildan keyin o'chiriladi */
export async function analyzeAction(input: unknown): Promise<AiResult<LegalReply>> {
  const { supabase, userId } = await requireUser();
  const a = AnalyzeSchema.safeParse(input);
  if (!a.success) return { ok: false, message: a.error.issues[0]?.message ?? "So'rov noto'g'ri." };
  const r = await analyzeLegalDocument(userId, await premiumOf(supabase), a.data);
  if (r.ok) revalidatePath("/app/savol");
  return r;
}
