import { describe, expect, it } from "vitest";
import { longestOptionBias } from "@/lib/bias";
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
  it("import qilingan bazadagi ulush — hisobotdagi raqam (regressiya)", () => {
    const qs = loadBundle().questions.filter((q) => "options" in q.payload && "index" in q.answer);
    const biased = qs.filter((q) => longestOptionBias((q.payload as { options: string[] }).options, (q.answer as { index: number }).index).biased);
    expect(biased.length).toBe(1074);
  });
});
