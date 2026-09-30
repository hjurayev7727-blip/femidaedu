"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizePin, PIN_RE } from "@/lib/live";
import { answerLive, createLiveRoom, hostAction, joinLiveRoom, type LiveResult } from "@/lib/live-server";
import { ResponseSchema } from "@/lib/practice";

export type JoinState = { message: string } | null;

export async function joinLive(_prev: JoinState, form: FormData): Promise<JoinState> {
  const pin = normalizePin(String(form.get("pin") ?? ""));
  if (!PIN_RE.test(pin)) return { message: "PIN 6 raqamdan iborat." };
  const r = await joinLiveRoom(pin, String(form.get("name") ?? ""));
  if (!r.ok) return { message: r.message };
  redirect(`/jonli/${r.value.roomId}`);
}

export async function answerLiveAction(roomId: string, itemId: number, response: unknown): Promise<LiveResult<null>> {
  const r = ResponseSchema.safeParse(response);
  if (!z.uuid().safeParse(roomId).success || !r.success || !Number.isSafeInteger(itemId)) return { ok: false, message: "Javob noto'g'ri shaklda." };
  return answerLive(roomId, itemId, r.data);
}

export async function hostControl(roomId: string, action: "next" | "reveal" | "finish"): Promise<boolean> {
  const { userId } = await requireUser();
  if (!z.uuid().safeParse(roomId).success || !["next", "reveal", "finish"].includes(action)) return false;
  return hostAction(userId, roomId, action);
}

/** Muallif sahifasidan: "Jonli viktorina" */
export async function startLive(form: FormData) {
  const { supabase, userId } = await requireUser();
  const p = z.object({
    test: z.coerce.number().int().positive(),
    seconds: z.coerce.number().int().min(5).max(120),
    group: z.coerce.number().int().positive().optional(),
  }).safeParse({ test: form.get("test"), seconds: form.get("seconds"), group: form.get("group") || undefined });
  if (!p.success) redirect("/app/testlar");
  const { data: premium } = await supabase.rpc("is_premium");
  const r = await createLiveRoom(userId, Boolean(premium), p.data.test, p.data.seconds, p.data.group ?? null);
  redirect(r.ok ? `/jonli/host/${r.value.roomId}` : `/app/testlar/${p.data.test}?jonli=${encodeURIComponent(r.message)}`);
}
