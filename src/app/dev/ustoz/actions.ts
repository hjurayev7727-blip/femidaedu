"use server";
// Faqat /dev/ustoz namunasi uchun: AI'ga murojaat qilmaydigan soxta amallar. Production'da ishlamaydi.
/* eslint-disable @typescript-eslint/no-unused-vars -- soxta amallar imzoni haqiqiylari bilan bir xil */
import type { PlanState } from "@/app/app/yordamchi/actions";
import type { AiResult } from "@/lib/ai-server";
import type { TutorReply } from "@/lib/tutor-server";

const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("dev only");
};
export async function demoAsk(threadId: string | null, _mode: unknown, _q: unknown): Promise<AiResult<TutorReply>> {
  dev();
  return {
    ok: true,
    value: {
      threadId: threadId ?? "00000000-0000-0000-0000-000000000000",
      answer: "Namuna javob: mehnat shartnomasi yozma shaklda tuziladi (Mehnat kodeksi 105-modda).\n\n- Birinchi nuqta\n- Ikkinchi nuqta",
      sources: [{ id: 1, ref: "Mehnat kodeksi 105-modda", field: "mehnat" }],
    },
  };
}
export async function demoPlan(_prev: PlanState, _form: FormData): Promise<PlanState> {
  dev();
  return { ok: false, message: "DEV: namuna — reja tuzilmaydi." };
}
export async function demoMistakes() {
  dev();
}
