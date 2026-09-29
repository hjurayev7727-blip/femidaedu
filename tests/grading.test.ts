import { describe, expect, it } from "vitest";
import { isOpenAnswerRight, numbers } from "@/lib/grading-open";
import { describeAnswer, gradeResponse } from "@/lib/questions";

describe("gradeResponse — tanlov", () => {
  const p = { options: ["a", "b", "c", "d"] };
  it("single / fill_blank / case", () => {
    for (const t of ["single", "fill_blank", "case"] as const) {
      expect(gradeResponse(t, p, { index: 2 }, { index: 2 })).toEqual({ correct: true, score: 1 });
      expect(gradeResponse(t, p, { index: 2 }, { index: 1 })).toEqual({ correct: false, score: 0 });
    }
  });
  it("noto'g'ri shakldagi javob — xato", () => {
    expect(gradeResponse("single", p, { index: 0 }, { text: "0" }).correct).toBe(false);
  });
  it("multi — tartibi va takror ahamiyatsiz", () => {
    expect(gradeResponse("multi", p, { indexes: [0, 2] }, { indexes: [2, 0, 0] }).correct).toBe(true);
    expect(gradeResponse("multi", p, { indexes: [0, 2] }, { indexes: [0] }).correct).toBe(false);
  });
});

describe("gradeResponse — moslashtirish va tartiblash", () => {
  it("matching: qisman ball", () => {
    const p = { left: ["A", "B", "C", "D"], right: ["w", "x", "y", "z"] };
    const a = { map: [2, 0, 3, 1] };
    expect(gradeResponse("matching", p, a, { map: [2, 0, 3, 1] })).toEqual({ correct: true, score: 1 });
    expect(gradeResponse("matching", p, a, { map: [2, 0, 1, 3] })).toEqual({ correct: false, score: 0.5 });
  });
  it("ordering", () => {
    const p = { items: ["c", "a", "b"] };
    expect(gradeResponse("ordering", p, { order: [1, 2, 0] }, { order: [1, 2, 0] }).correct).toBe(true);
    expect(gradeResponse("ordering", p, { order: [1, 2, 0] }, { order: [1, 0, 2] })).toEqual({ correct: false, score: 1 / 3 });
  });
});

describe("yozma javob (v1 mantiqi)", () => {
  const num = { accepted: ["155"], show: "155" };
  it.each(["155", "155 ta", "bir yuz ellik besh", "155-modda", " 155 "])("son: %s", (raw) =>
    expect(isOpenAnswerRight(num, raw, "number")).toBe(true),
  );
  it.each(["154", "155 yoki 156", "", "ko'p"])("son xato: %s", (raw) => expect(isOpenAnswerRight(num, raw, "number")).toBe(false));

  it("ming va bo'shliqli sonlar", () => {
    expect(numbers("220 ming")).toEqual([220000]);
    expect(numbers("100 000 so'm")).toEqual([100000]);
    expect(numbers("yigirma besh")).toEqual([25]);
    expect(numbers("90,21")).toEqual([90.21]);
  });

  const txt = { accepted: ["asosiy prinsiplar", "asosiy tamoyillar"], show: "«Asosiy prinsiplar»" };
  it.each(["Asosiy prinsiplar", "asosiy prinsiplar deb", "asosiy prinsplar", "«Asosiy tamoyillar»", "Асосий принциплар"])(
    "matn: %s",
    (raw) => expect(isOpenAnswerRight(txt, raw, "text")).toBe(true),
  );
  it.each(["prinsiplar", "asosiy qoidalar", ""])("matn xato: %s", (raw) => expect(isOpenAnswerRight(txt, raw, "text")).toBe(false));
});

describe("describeAnswer", () => {
  it("variant harfi bilan", () => {
    expect(describeAnswer("single", { options: ["x", "y"] }, { index: 1 })).toBe("B) y");
  });
  it("moslashtirish juftliklari", () => {
    expect(describeAnswer("matching", { left: ["A", "B"], right: ["1", "2"] }, { map: [1, 0] })).toBe("A — 2; B — 1");
  });
});
