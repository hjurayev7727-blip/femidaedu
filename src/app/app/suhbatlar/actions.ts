"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { MessageSchema, OfferSchema } from "@/lib/chat";
import { makeOffer, openConversation, sendMessage } from "@/lib/chat-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function sendAction(conv: unknown, body: unknown): Promise<AiResult<{ id: number; masked: boolean }>> {
  const { userId } = await requireUser();
  const c = z.uuid().safeParse(conv);
  const b = MessageSchema.safeParse(body);
  if (!c.success) return { ok: false, message: "Suhbat topilmadi." };
  if (!b.success) return { ok: false, message: b.error.issues[0]?.message ?? "Xabar bo'sh" };
  return sendMessage(userId, c.data, b.data);
}

export async function offerAction(conv: unknown, price: unknown, note: unknown): Promise<AiResult<number>> {
  const { userId } = await requireUser();
  const c = z.uuid().safeParse(conv);
  const o = OfferSchema.safeParse({ price_uzs: price, note });
  if (!c.success) return { ok: false, message: "Suhbat topilmadi." };
  if (!o.success) return { ok: false, message: o.error.issues[0]?.message ?? "Taklif noto'g'ri" };
  return makeOffer(userId, c.data, o.data.price_uzs, o.data.note);
}

export async function declineAction(offer: unknown): Promise<boolean> {
  const { userId } = await requireUser();
  const id = z.coerce.number().int().positive().safeParse(offer);
  if (!id.success) return false;
  const { data } = await createSupabaseAdmin().rpc("decline_offer", { p_user: userId, p_offer: id.data });
  return Boolean(data);
}

/** Mijoz: yurist profilidan "Xabar yozish" */
export async function startChat(form: FormData) {
  const { userId } = await requireUser();
  const lawyer = z.uuid().safeParse(form.get("lawyer"));
  if (!lawyer.success) redirect("/app/yuristlar");
  const r = await openConversation(userId, lawyer.data, null);
  redirect(r.ok ? `/app/suhbatlar/${r.value}` : `/app/yuristlar/${lawyer.data}?xato=${encodeURIComponent(r.message)}`);
}

/** Yurist: arizaga javob berish */
export async function replyRequest(form: FormData) {
  const { userId } = await requireUser();
  const req = z.coerce.number().int().positive().safeParse(form.get("request"));
  if (!req.success) redirect("/app/yurist/arizalar");
  const { data } = await createSupabaseAdmin().from("legal_requests").select("client_id").eq("id", req.data).maybeSingle<{ client_id: string }>();
  if (!data) redirect("/app/yurist/arizalar");
  const r = await openConversation(userId, data.client_id, req.data);
  redirect(r.ok ? `/app/suhbatlar/${r.value}` : `/app/yurist/arizalar?xato=${encodeURIComponent(r.message)}`);
}

export async function closeRequest(form: FormData) {
  const { userId } = await requireUser();
  const req = z.coerce.number().int().positive().safeParse(form.get("request"));
  if (req.success) await createSupabaseAdmin().rpc("close_request", { p_user: userId, p_request: req.data });
  redirect("/app/suhbatlar");
}
