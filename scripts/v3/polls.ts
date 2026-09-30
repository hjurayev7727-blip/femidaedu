// V3 so'rovnomasi (data/v3/polls.json) — Telegram so'rovnomalari sifatida kanal/guruhga yuborish.
// Natija ham shu yerdan olinadi: Telegram har so'rovnoma yopilganda ovozlarni qaytaradi (stopPoll).
import { readFileSync } from "node:fs";
import { z } from "zod";

// Telegram cheklovlari: savol 1–300, variant 1–100 belgi, 2–10 variant
export const PollSchema = z.object({
  id: z.number().int().positive(),
  block: z.string().min(1),
  q: z.string().min(1).max(300),
  multi: z.boolean(),
  options: z.array(z.string().min(1).max(100)).min(2).max(10),
  owner: z.string().min(1), // loyiha egasining javobi
  decision: z.string().min(1),
});
export type Poll = z.infer<typeof PollSchema>;

export const PollFileSchema = z.object({ polls: z.array(PollSchema).min(40) }).passthrough();

export function loadPolls(path = "data/v3/polls.json"): Poll[] {
  return PollFileSchema.parse(JSON.parse(readFileSync(path, "utf8"))).polls;
}

/** sendPoll parametrlari. Ovozlar anonim — real so'rovnomada odamlar ochiqroq javob beradi. */
export function sendPollParams(chatId: number | string, p: Poll) {
  return {
    chat_id: chatId,
    question: p.q,
    options: p.options.map((text) => ({ text })),
    is_anonymous: true,
    allows_multiple_answers: p.multi,
  };
}
