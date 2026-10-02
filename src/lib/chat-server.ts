import "server-only";
import type { AiResult } from "@/lib/ai-server";
import { notifyUser } from "@/lib/bot/server";
import type { ChatPoll } from "@/lib/chat";
import { esc } from "@/lib/bot/api";
import { fmtSum, maskContacts } from "@/lib/lawyers";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const REASON: Record<string, string> = {
  open_limit: "Sizda 3 ta ochiq ariza bor. Avval birini yoping.",
  day_limit: "Bugun ko'p ariza yubordingiz. Ertaga urinib ko'ring.",
  field: "Soha noto'g'ri.",
  lawyer: "Yurist topilmadi yoki hozir faol emas.",
  request: "Ariza topilmadi yoki yopilgan.",
  not_found: "Suhbat topilmadi.",
  blocked: "Yurist profili bloklangan — yozishma to'xtatilgan.",
  rate: "Juda tez yozyapsiz. Biroz kuting.",
};
type R = { ok: boolean; reason?: string } & Record<string, unknown>;
const fail = (r: R | null): AiResult<never> => ({ ok: false, message: REASON[r?.reason ?? ""] ?? "Xatolik yuz berdi." });

export async function createRequest(userId: string, p: Record<string, unknown>): Promise<AiResult<{ id: number; recipients: number }>> {
  const { data } = await createSupabaseAdmin().rpc("create_legal_request", { p_user: userId, p });
  const r = data as R | null;
  if (!r?.ok) return fail(r);
  // Yuristlarga bildirishnoma (bot ulangan bo'lsa)
  const { data: rec } = await createSupabaseAdmin().from("request_recipients").select("lawyer_id").eq("request_id", r.id as number).returns<{ lawyer_id: string }[]>();
  await Promise.all((rec ?? []).map((x) => notifyUser(x.lawyer_id, `📩 <b>Yangi ariza</b>\n${esc(String(p.title ?? ""))}`, { text: "Arizalarni ko'rish", path: "/app/yurist/arizalar" })));
  return { ok: true, value: { id: r.id as number, recipients: r.recipients as number } };
}

export async function openConversation(userId: string, other: string, request: number | null): Promise<AiResult<string>> {
  const { data } = await createSupabaseAdmin().rpc("open_conversation", { p_user: userId, p_other: other, p_request: request });
  const r = data as R | null;
  return r?.ok ? { ok: true, value: r.id as string } : fail(r);
}

/** Xabar: to'lovgacha kontaktlar yashiriladi (saqlashdan oldin — chetlab o'tib bo'lmaydi) */
export async function sendMessage(userId: string, conv: string, body: string): Promise<AiResult<{ id: number; masked: boolean }>> {
  const admin = createSupabaseAdmin();
  const { data: paid } = await admin.rpc("conversation_paid", { p_conv: conv });
  const m = paid ? { text: body, masked: false } : maskContacts(body);
  const { data } = await admin.rpc("send_message", { p_user: userId, p_conv: conv, p_body: m.text });
  const r = data as R | null;
  if (!r?.ok) return fail(r);
  if (typeof r.notify === "string") {
    await notifyUser(r.notify, `💬 <b>Yangi xabar</b>\n${esc(m.text.slice(0, 200))}`, { text: "Javob berish", path: `/app/suhbatlar/${conv}` });
  }
  return { ok: true, value: { id: r.id as number, masked: m.masked } };
}

export async function makeOffer(lawyerId: string, conv: string, price: number, note: string): Promise<AiResult<number>> {
  const admin = createSupabaseAdmin();
  const { data: paid } = await admin.rpc("conversation_paid", { p_conv: conv });
  const { data } = await admin.rpc("make_offer", { p_lawyer: lawyerId, p_conv: conv, p_price: price, p_note: paid ? note : maskContacts(note).text });
  const r = data as R | null;
  if (!r?.ok) return fail(r);
  await notifyUser(r.client as string, `💼 <b>Yuristdan narx taklifi</b>: ${fmtSum(price)}`, { text: "Taklifni ko'rish", path: `/app/suhbatlar/${conv}` });
  return { ok: true, value: r.id as number };
}

export async function chatPoll(userId: string, conv: string, after: number): Promise<ChatPoll> {
  const { data } = await createSupabaseAdmin().rpc("chat_poll", { p_user: userId, p_conv: conv, p_after: after });
  return (data ?? { ok: false, reason: "not_found" }) as ChatPoll;
}

export type ConversationInfo = {
  id: string; role: "client" | "lawyer"; lawyer_id: string; lawyer_name: string; lawyer_verified: boolean;
  lawyer_status: "active" | "hidden" | "blocked"; client_name: string;
  request: { id: number; title: string; body: string; ai_snapshot: string | null } | null;
};

export async function conversationInfo(userId: string, conv: string) {
  const { data } = await createSupabaseAdmin().rpc("conversation_info", { p_user: userId, p_conv: conv });
  return (data ?? null) as ConversationInfo | null;
}
