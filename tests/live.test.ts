// Jonli viktorina: sof funksiyalar va bot havolasi.
import { describe, expect, it, vi } from "vitest";
import { appUrl, handleUpdate, type BotDeps } from "@/lib/bot/handler";
import { liveLinks, normalizePin, PIN_RE, secondsLeft } from "@/lib/live";

describe("jonli viktorina", () => {
  it("PIN: faqat raqamlar, 6 ta", () => {
    expect(normalizePin(" 123 456 ")).toBe("123456");
    expect(normalizePin("12-34-567")).toBe("123456");
    expect(PIN_RE.test("12345")).toBe(false);
  });

  it("havolalar: sayt va Telegram Mini App", () => {
    expect(liveLinks("012345", "https://femidaedu.uz/", "FemidaEduBot")).toEqual({
      web: "https://femidaedu.uz/jonli?pin=012345", telegram: "https://t.me/FemidaEduBot?startapp=j_012345",
    });
    expect(liveLinks("012345", "https://x.uz", null).telegram).toBeNull();
  });

  it("taymer server vaqtiga nisbatan (qurilma soati 10 s orqada)", () => {
    const now = Date.parse("2026-10-01T10:00:00Z");
    const ends = "2026-10-01T10:00:20Z";
    expect(secondsLeft(ends, 0, now)).toBe(20);
    expect(secondsLeft(ends, 10_000, now - 10_000)).toBe(20);
    expect(secondsLeft(ends, 0, now + 25_000)).toBe(0);
    expect(secondsLeft(null, 0, now)).toBe(0);
  });

  it("bot: /start j_PIN — qo'shilish tugmasi", async () => {
    const sent: { html: string; opts?: unknown }[] = [];
    const d: BotDeps = {
      api: { call: vi.fn(), sendMessage: vi.fn(async (_c: number, html: string, opts?: unknown) => void sent.push({ html, opts })) },
      siteUrl: "https://femidaedu.uz", stats: async () => ({ found: false }), setBotEnabled: async () => true,
      loginRequest: async () => null, confirmLogin: async () => false,
    };
    await handleUpdate({ update_id: 1, message: { message_id: 1, from: { id: 5, first_name: "A" }, chat: { id: 5, type: "private" }, text: "/start j_012345" } }, d);
    expect(sent[0].html).toContain("012345");
    expect(JSON.stringify(sent[0].opts)).toContain(JSON.stringify(appUrl("https://femidaedu.uz", "/jonli?pin=012345")).slice(1, -1));
  });
});
