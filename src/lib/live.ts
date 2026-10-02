// Jonli viktorina (V3, 6-qism): limitlar, havolalar, holat turi. Sof funksiyalar (klient va server).
import type { Answer, Payload, QuestionType } from "@/lib/questions";

/** Bepul: 30 ishtirokchigacha; Premium — 200 */
export const LIVE_FREE_MAX = 30;
export const LIVE_PREMIUM_MAX = 200;
export const LIVE_SECONDS = [10, 20, 30, 60] as const;
export const PIN_RE = /^\d{6}$/;
export const POLL_MS = 1500;

export const normalizePin = (s: string) => s.replace(/\D/g, "").slice(0, 6);

export function liveLinks(pin: string, siteUrl: string, bot: string | null) {
  return {
    web: `${siteUrl.replace(/\/$/, "")}/jonli?pin=${pin}`,
    telegram: bot ? `https://t.me/${bot}?startapp=j_${pin}` : null,
  };
}

export type LiveStatus = "lobby" | "question" | "reveal" | "finished";
export type LiveTop = { name: string; score: number; correct: number };
export type LiveState = {
  ok: true;
  status: LiveStatus;
  title: string;
  pin: string;
  pos: number;
  total: number;
  seconds: number;
  ends_at: string | null;
  now: string;
  max_players: number;
  players: number;
  answered: number;
  item: { id: number; type: QuestionType; stem: string; context: string | null; payload: Payload; difficulty: number } | null;
  answer: Answer | null;
  explanation: string | null;
  names: string[] | null;
  top: LiveTop[] | null;
  distribution: Record<string, number> | null;
  me: { name: string; score: number; correct: number; rank: number; answered: boolean; last: { correct: boolean; points: number } | null } | null;
};
export type LiveStateResult = LiveState | { ok: false; reason: string };

export const JOIN_ERRORS: Record<string, string> = {
  not_found: "Bunday PIN bilan faol viktorina topilmadi.",
  full: "Xona to'lgan.",
  name: "Ismingizni yozing (kamida 2 harf).",
};

/** Qolgan soniyalar. offsetMs = server vaqti − qurilma vaqti (holat olingan paytda) */
export function secondsLeft(endsAt: string | null, offsetMs: number, nowMs: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - (nowMs + offsetMs)) / 1000));
}
