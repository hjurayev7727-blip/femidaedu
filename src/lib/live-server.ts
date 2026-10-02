import "server-only";
import { gradeResponse, type Answer, type Payload, type QuestionType, type Response } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { JOIN_ERRORS, LIVE_FREE_MAX, LIVE_PREMIUM_MAX, type LiveStateResult } from "@/lib/live";
import { currentActor, ensureGuest } from "@/lib/user-tests-server";

export type LiveResult<T> = { ok: true; value: T } | { ok: false; message: string };

export async function createLiveRoom(userId: string, premium: boolean, testId: number, seconds: number, groupId: number | null): Promise<LiveResult<{ roomId: string; pin: string }>> {
  const { data } = await createSupabaseAdmin().rpc("create_live_room", {
    p_host: userId, p_test: testId, p_seconds: seconds, p_max: premium ? LIVE_PREMIUM_MAX : LIVE_FREE_MAX, p_group: groupId,
  });
  const r = data as { ok: boolean; reason?: string; room_id?: string; pin?: string } | null;
  if (!r?.ok) return { ok: false, message: r?.reason === "no_items" ? "Testda savol yo'q." : r?.reason === "group" ? "Guruh topilmadi." : "Xona ochib bo'lmadi." };
  return { ok: true, value: { roomId: r.room_id!, pin: r.pin! } };
}

/** PIN bilan qo'shilish: kirgan foydalanuvchi yoki mehmon (httpOnly token) */
export async function joinLiveRoom(pin: string, name: string): Promise<LiveResult<{ roomId: string }>> {
  const actor = await currentActor();
  const guest = actor.userId ? null : await ensureGuest();
  const { data } = await createSupabaseAdmin().rpc("join_live_room", { p_pin: pin, p_user: actor.userId, p_guest: guest, p_name: name });
  const r = data as { ok: boolean; reason?: string; room_id?: string } | null;
  if (!r?.ok) return { ok: false, message: JOIN_ERRORS[r?.reason ?? ""] ?? "Qo'shilib bo'lmadi." };
  return { ok: true, value: { roomId: r.room_id! } };
}

export async function liveState(roomId: string, host: boolean): Promise<LiveStateResult> {
  const actor = await currentActor();
  if (host && !actor.userId) return { ok: false, reason: "not_found" };
  const { data } = await createSupabaseAdmin().rpc("live_state", { p_room: roomId, p_user: actor.userId, p_guest: actor.guest, p_host: host });
  return (data as LiveStateResult | null) ?? { ok: false, reason: "not_found" };
}

const ANSWER_ERR: Record<string, string> = { closed: "Vaqt tugadi.", duplicate: "Javob berilgan.", not_joined: "Siz bu xonada emassiz." };

/** Javob: joriy savol kaliti serverda o'qiladi, baholanadi, ball SQL'da (tezlik bo'yicha) hisoblanadi */
export async function answerLive(roomId: string, itemId: number, response: Response): Promise<LiveResult<null>> {
  const actor = await currentActor();
  const admin = createSupabaseAdmin();
  const { data: room } = await admin.from("live_rooms").select("item_ids, current_pos").eq("id", roomId).maybeSingle<{ item_ids: number[]; current_pos: number }>();
  if (!room || room.current_pos < 0 || Number(room.item_ids[room.current_pos]) !== itemId) return { ok: false, message: ANSWER_ERR.closed };
  const { data: item } = await admin.from("test_items").select("type, payload, answer").eq("id", itemId)
    .maybeSingle<{ type: QuestionType; payload: Payload; answer: Answer }>();
  if (!item) return { ok: false, message: ANSWER_ERR.closed };
  const correct = gradeResponse(item.type, item.payload, item.answer, response).correct;
  const { data } = await admin.rpc("live_answer", { p_room: roomId, p_user: actor.userId, p_guest: actor.guest, p_item: itemId, p_response: response, p_correct: correct });
  const r = data as { ok: boolean; reason?: string } | null;
  return r?.ok ? { ok: true, value: null } : { ok: false, message: ANSWER_ERR[r?.reason ?? ""] ?? "Javob saqlanmadi." };
}

export async function hostAction(userId: string, roomId: string, action: "next" | "reveal" | "finish"): Promise<boolean> {
  const admin = createSupabaseAdmin();
  if (action === "next") {
    const { data } = await admin.rpc("live_next", { p_host: userId, p_room: roomId });
    return Boolean((data as { ok: boolean } | null)?.ok);
  }
  const { data } = await admin.rpc("live_control", { p_host: userId, p_room: roomId, p_action: action });
  return Boolean(data);
}
