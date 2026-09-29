import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildMockPlan, evaluateMock, gradeFor, NotEnoughQuestions, planLabel, planMax, scoreMock, type Blueprint, type PoolQuestion } from "@/lib/mock";
import { loadBundle } from "./helpers/db";

// seed.sql dagi standart shablonni o'qiymiz — test va baza bir xil manbadan
const seed = readFileSync(join(__dirname, "..", "supabase/seed.sql"), "utf8");
const bp = JSON.parse(/'(\{\s*"sections"[\s\S]*?\})'::jsonb/.exec(seed)![1]) as Blueprint;
const grades = JSON.parse(/'(\[\{"grade": "A\+"[\s\S]*?\])'::jsonb/.exec(seed)![1]);
const template = { raw_max: 100, scale_max: 75, grades };

const pool: PoolQuestion[] = loadBundle().questions.map((q, i) => ({
  id: i + 1,
  type: q.type,
  difficulty: q.difficulty,
  documentId: q.documentNumber,
}));

function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("buildMockPlan (haqiqiy savollar bazasi bilan)", () => {
  const plan = buildMockPlan(pool, bp, seeded(1));
  const byId = new Map(pool.map((q) => [q.id, q]));

  it("45 topshiriq: 35 yopiq + 10 yozma (a/b) = 55 savol, takrorsiz", () => {
    expect(plan).toHaveLength(55);
    expect(new Set(plan.map((p) => p.q)).size).toBe(55);
    expect(new Set(plan.map(planLabel)).size).toBe(55);
    expect(plan.filter((p) => p.kind === "closed")).toHaveLength(35);
  });

  it("jami birlamchi ball 100 (yopiq 75 + yozma 25)", () => {
    expect(planMax(plan)).toBe(100);
    expect(planMax(plan.filter((p) => p.kind === "closed"))).toBe(75);
  });

  it("bo'limlar turi shablonga mos", () => {
    for (const p of plan) {
      const t = byId.get(p.q)!.type;
      if (p.n <= 32) expect(["single", "multi", "matching", "ordering", "case"]).toContain(t);
      else if (p.n <= 35) expect(t).toBe("fill_blank");
      else expect(t).toBe("open");
    }
  });

  it("yopiq qismda bitta hujjatdan 3 tadan ko'p emas", () => {
    const perDoc = new Map<number, number>();
    for (const p of plan.filter((x) => x.kind === "closed")) {
      const d = byId.get(p.q)!.documentId;
      if (d != null) perDoc.set(d, (perDoc.get(d) ?? 0) + 1);
    }
    expect(Math.max(...perDoc.values())).toBeLessThanOrEqual(3);
  });

  it("qiyinlik taqsimoti 10/18/7 — ball ham shunga mos", () => {
    const pts = plan.filter((p) => p.kind === "closed").map((p) => p.points);
    expect(pts.filter((x) => x === 1.3)).toHaveLength(10);
    expect(pts.filter((x) => x === 2.2)).toHaveLength(18);
    expect(pts.filter((x) => x === 3.2)).toHaveLength(7);
  });

  it("har safar boshqa to'plam", () => {
    const other = buildMockPlan(pool, bp, seeded(2));
    const overlap = other.filter((p) => plan.some((x) => x.q === p.q)).length;
    expect(overlap).toBeLessThan(40);
  });

  it("savol yetmasa — tushunarli xato", () => {
    expect(() => buildMockPlan(pool.slice(0, 20), bp)).toThrow(NotEnoughQuestions);
  });
});

describe("ball va daraja", () => {
  it.each([
    [75, "A+"], [70, "A+"], [69.9, "A"], [65, "A"], [60, "B+"], [55, "B"], [50, "C+"], [46, "C"], [45.9, null], [0, null],
  ])("%s ball → %s", (scaled, g) => expect(gradeFor(scaled, grades)).toBe(g));

  it("hammasi to'g'ri → 100 / 75 / A+; hech biri → 0", () => {
    const plan = buildMockPlan(pool, bp, seeded(3));
    const all = new Map(plan.map((p) => [p.q, true]));
    expect(scoreMock(plan, all, template)).toEqual({ raw: 100, scaled: 75, grade: "A+", correct: 55 });
    expect(scoreMock(plan, new Map(), template)).toEqual({ raw: 0, scaled: 0, grade: null, correct: 0 });
  });

  it("faqat yopiq qism to'g'ri → 75 birlamchi → 56,3 → B", () => {
    const plan = buildMockPlan(pool, bp, seeded(4));
    const closed = new Map(plan.filter((p) => p.kind === "closed").map((p) => [p.q, true]));
    expect(scoreMock(plan, closed, template)).toMatchObject({ raw: 75, scaled: 56.3, grade: "B" });
  });
});

describe("evaluateMock", () => {
  const plan = [
    { n: 1, part: null, q: 1, points: 1.3, kind: "closed" as const },
    { n: 2, part: null, q: 2, points: 3.2, kind: "closed" as const },
    { n: 36, part: "a" as const, q: 3, points: 1.1, kind: "written" as const },
    { n: 36, part: "b" as const, q: 4, points: 1.1, kind: "written" as const },
  ];
  const qs = [
    { id: 1, type: "single" as const, payload: { options: ["a", "b"] }, answer: { index: 0 }, document_id: 2, docTitle: "Bayroq" },
    { id: 2, type: "single" as const, payload: { options: ["a", "b"] }, answer: { index: 1 }, document_id: 1, docTitle: "Konstitutsiya" },
    { id: 3, type: "open" as const, payload: { kind: "number" as const }, answer: { accepted: ["155"], show: "155" }, document_id: 1, docTitle: "Konstitutsiya" },
    { id: 4, type: "open" as const, payload: { kind: "text" as const }, answer: { accepted: ["senat"], show: "Senat" }, document_id: 1, docTitle: "Konstitutsiya" },
  ];

  it("javobsiz savol 0 ball, natijalar ro'yxatiga kirmaydi; tahlil eng zaif hujjatdan boshlanadi", () => {
    const r = evaluateMock(plan, qs, new Map([[1, { index: 0 }], [2, { index: 0 }], [3, { text: "bir yuz ellik besh" }]]), template);
    expect(r.results).toEqual([
      { q: 1, correct: true, points: 1.3 },
      { q: 2, correct: false, points: 0 },
      { q: 3, correct: true, points: 1.1 },
    ]);
    expect(r.score.raw).toBe(2.4);
    expect(r.breakdown.byDoc.map((d) => d.title)).toEqual(["Konstitutsiya", "Bayroq"]);
    expect(r.breakdown.byDoc[0]).toMatchObject({ earned: 1.1, max: 5.4 });
    expect(r.breakdown.closed).toEqual({ earned: 1.3, max: 4.5 });
    expect(r.breakdown.written).toEqual({ earned: 1.1, max: 2.2 });
  });
});
