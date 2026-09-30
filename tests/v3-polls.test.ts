// data/v3/polls.json: Telegram cheklovlari va modellashtirilgan natijalar izchilligi.
import { describe, expect, it } from "vitest";
import { loadPolls, sendPollParams } from "../scripts/v3/polls";

const polls = loadPolls();

describe("V3 so'rovnomasi", () => {
  it("kamida 40 ta, id takrorlanmaydi va ketma-ket", () => {
    expect(polls.length).toBeGreaterThanOrEqual(40);
    expect(polls.map((p) => p.id)).toEqual(polls.map((_, i) => i + 1));
  });

  it("har variantga natija bor; bitta tanlovli so'rovnomalar 100% ga teng", () => {
    for (const p of polls) {
      expect(p.sim, `#${p.id}`).toHaveLength(p.options.length);
      if (!p.multi) expect(p.sim.reduce((a, b) => a + b, 0), `#${p.id}`).toBe(100);
    }
  });

  it("variantlar bir so'rovnoma ichida takrorlanmaydi", () => {
    for (const p of polls) expect(new Set(p.options).size, `#${p.id}`).toBe(p.options.length);
  });

  it("sendPoll parametrlari", () => {
    const p = polls[0];
    expect(sendPollParams("@kanal", p)).toEqual({
      chat_id: "@kanal",
      question: p.q,
      options: p.options.map((text) => ({ text })),
      is_anonymous: true,
      allows_multiple_answers: p.multi,
    });
  });
});
