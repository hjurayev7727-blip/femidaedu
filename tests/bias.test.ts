import { describe, expect, it } from "vitest";
import { longestOptionBias } from "@/lib/bias";
import { applyOptionFixes, type Bundle } from "../scripts/import/bundle";
import { loadBundle } from "./helpers/db";

describe("longestOptionBias", () => {
  it("keskin uzun to'g'ri javob — ko'zga tashlanadi", () => {
    expect(longestOptionBias(["Ha", "Yo'q", "Qonunda belgilangan hollarda sud qarori bilan", "Hech qachon"], 2).biased).toBe(true);
  });
  it("uzunliklar yaqin yoki to'g'ri javob eng uzun emas — yo'q", () => {
    expect(longestOptionBias(["1992-yil 8-dekabr", "1991-yil 1-sentabr", "1991-yil 18-noyabr", "1992-yil 2-iyul"], 2).biased).toBe(false);
    expect(longestOptionBias(["qisqa", "juda ham uzun variant matni", "o'rta", "yana"], 0).biased).toBe(false);
    expect(longestOptionBias(["abcdefgh", "abcdefghijk"], 1).biased).toBe(false); // 8 belgidan kam farq
  });
  it("fixes.json qo'llangach keskin uzun to'g'ri javob qolmagan (regressiya)", () => {
    const qs = loadBundle().questions.filter((q) => "options" in q.payload && "index" in q.answer);
    const biased = qs.filter((q) => longestOptionBias((q.payload as { options: string[] }).options, (q.answer as { index: number }).index).biased);
    expect(biased.length).toBe(0);
  });
});

describe("applyOptionFixes", () => {
  const make = (): Bundle => ({
    version: 1,
    documents: [],
    topics: [],
    questions: [
      { legacyKey: "a", type: "single", stem: "?", context: null, payload: { options: ["Ha", "Yo'q", "Sud qarori bilan belgilangan hollarda"] }, answer: { index: 2 }, explanation: null, sourceNote: null, difficulty: 1, documentNumber: null, topicSlug: null },
    ],
  });
  it("chalg'ituvchi variantlarni almashtiradi, to'g'ri javob joyida qoladi", () => {
    const b = make();
    const r = applyOptionFixes(b, { a: { options: ["Prokuror ruxsati bilan har qanday holatda", "Faqat ichki ishlar organi qarori bilan", "Sud qarori bilan belgilangan hollarda"] } });
    expect(r).toEqual({ applied: 1, skipped: [] });
    expect(b.questions[0].payload).toEqual({ options: ["Prokuror ruxsati bilan har qanday holatda", "Faqat ichki ishlar organi qarori bilan", "Sud qarori bilan belgilangan hollarda"] });
  });
  it("to'g'ri javob matni o'zgargan, variantlar soni boshqa yoki kalit yo'q — qo'llanmaydi", () => {
    const b = make();
    const r = applyOptionFixes(b, {
      a: { options: ["x", "y", "Boshqa javob"] },
      b: { options: ["x", "y", "z"] },
    });
    expect(r).toEqual({ applied: 0, skipped: ["a", "b"] });
    expect(b.questions[0].payload).toEqual(make().questions[0].payload);
  });
});
