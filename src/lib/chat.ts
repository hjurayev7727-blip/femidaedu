// Yozishma va arizalar: turlar, polling oralig'i, xabarlarni birlashtirish, shakllar. Sof funksiyalar.
import { z } from "zod";

export const POLL_MS = 2500;
/** Foydalanuvchi 1 daqiqa harakatsiz bo'lsa, so'rovlar siyraklashadi */
export const IDLE_POLL_MS = 10_000;
export const IDLE_AFTER_MS = 60_000;

export type ChatMsg = { id: number; mine: boolean; kind: "text" | "system" | "offer"; body: string; offer_id: number | null; created_at: string };
export type ChatOffer = { id: number; price_uzs: number; note: string; status: "pending" | "accepted" | "withdrawn" | "declined" };
export type ChatPoll =
  | { ok: true; role: "client" | "lawyer"; other_read: number; paid: boolean; messages: ChatMsg[]; offers: ChatOffer[] }
  | { ok: false; reason: string };

/** Yangi xabarlarni qo'shish: id bo'yicha takrorsiz va tartibli (vaqtinchalik — manfiy id — xabarlar almashtiriladi) */
export function mergeMessages(current: ChatMsg[], incoming: ChatMsg[]): ChatMsg[] {
  if (!incoming.length) return current;
  const byId = new Map<number, ChatMsg>();
  for (const m of current) if (m.id > 0) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const pendingLocal = current.filter((m) => m.id < 0 && !incoming.some((i) => i.mine && i.body === m.body));
  return [...[...byId.values()].sort((a, b) => a.id - b.id), ...pendingLocal];
}

export const lastId = (msgs: ChatMsg[]) => msgs.reduce((m, x) => (x.id > m ? x.id : m), 0);

export const MessageSchema = z.string().trim().min(1, "Xabar bo'sh").max(4000, "Xabar 4000 belgidan oshmasin");
export const OfferSchema = z.object({
  price_uzs: z.coerce.number().int().min(10_000, "Narx kamida 10 000 so'm").max(100_000_000),
  note: z.string().trim().min(5, "Xizmatni qisqacha yozing").max(1000),
});

export const RequestSchema = z.object({
  title: z.string().trim().min(5, "Sarlavha kamida 5 belgi").max(120),
  body: z.string().trim().min(20, "Vaziyatni batafsilroq yozing (kamida 20 belgi)").max(4000),
  field: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^[a-z-]{2,40}$/).nullable()),
  region: z.preprocess((v) => (v === "" ? null : v), z.string().max(60).nullable()),
  target_lawyer: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable()),
  tutor_message_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.coerce.number().int().positive().nullable()),
});
