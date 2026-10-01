"use server";
// Faqat ishlab chiqish uchun: "Savol bering" namuna javoblari (Supabase va AI'siz)
import type { AiResult } from "@/lib/ai-server";
import type { LegalReply } from "@/lib/legal-server";

const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("dev only");
};

const REPLY: LegalReply = {
  threadId: "00000000-0000-0000-0000-000000000000",
  answer: "Namuna javob. Ish haqi kamida oyiga bir marta to'lanadi (Mehnat kodeksi 161-modda).",
  confidence: "medium",
  needsLawyer: false,
  sources: [{ id: 3, ref: "Mehnat kodeksi 161-modda", field: "mehnat" }],
};

export async function demoAskLegal(): Promise<AiResult<LegalReply>> {
  dev();
  return { ok: true, value: REPLY };
}

export async function demoUpload(): Promise<AiResult<{ path: string; token: string }>> {
  dev();
  return { ok: false, message: "Namuna sahifada fayl yuklanmaydi." };
}

export async function demoAnalyze(): Promise<AiResult<LegalReply>> {
  dev();
  return { ok: false, message: "Namuna sahifada tahlil qilinmaydi." };
}
