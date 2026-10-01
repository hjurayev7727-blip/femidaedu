"use server";
import { redirect } from "next/navigation";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { RequestSchema } from "@/lib/chat";
import { createRequest } from "@/lib/chat-server";
import { lawyersEnabled } from "@/lib/legal-server";

export type RequestState = AiResult<never> | null;

export async function createRequestAction(_prev: RequestState, form: FormData): Promise<RequestState> {
  const { userId } = await requireUser();
  if (!(await lawyersEnabled())) return { ok: false, message: "Yuristlar bo'limi hali ochilmagan." };
  const p = RequestSchema.safeParse({
    title: form.get("title"), body: form.get("body"), field: form.get("field") ?? "", region: form.get("region") ?? "",
    target_lawyer: form.get("lawyer") ?? "", tutor_message_id: form.get("from") ?? "",
  });
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Forma noto'g'ri to'ldirilgan." };
  const r = await createRequest(userId, p.data);
  if (!r.ok) return r;
  redirect(`/app/suhbatlar?ariza=${r.value.id}`);
}
