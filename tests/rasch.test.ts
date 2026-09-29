import { describe, expect, it } from "vitest";
import { bandOf, difficultyBands, estimateRasch, type Response } from "@/lib/rasch";

/** Seed'li tasodifiy sonlar va normal taqsimot (Box–Muller) */
function rng(seed: number) {
  let a = seed;
  const u = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(u() || 1e-12)) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}

function corr(x: number[], y: number[]) {
  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my);
    sxx += (x[i] - mx) ** 2;
    syy += (y[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

/** Haqiqiy θ va b dan javoblar simulyatsiyasi; har o'quvchi savollarning bir qismini ko'radi (real hayotdagidek) */
function simulate(nPersons: number, nItems: number, coverage: number, seed: number) {
  const r = rng(seed);
  const trueB = Array.from({ length: nItems }, () => r.normal());
  const trueTheta = Array.from({ length: nPersons }, () => r.normal());
  const data: Response[] = [];
  for (let j = 0; j < nPersons; j++) {
    for (let i = 0; i < nItems; i++) {
      if (r.u() > coverage) continue;
      const pr = 1 / (1 + Math.exp(-(trueTheta[j] - trueB[i])));
      data.push({ person: `p${j}`, item: i, correct: r.u() < pr });
    }
  }
  return { trueB, trueTheta, data };
}

describe("estimateRasch", () => {
  it("sintetik ma'lumotda haqiqiy qiyinlik va qobiliyatni tiklaydi", () => {
    const { trueB, trueTheta, data } = simulate(600, 60, 0.5, 42);
    const r = estimateRasch(data);
    expect(r.converged).toBe(true);
    const items = [...r.items].map(([k, v]) => [Number(k), v.b] as const);
    expect(corr(items.map(([k]) => trueB[k]), items.map(([, b]) => b))).toBeGreaterThan(0.97);
    const persons = [...r.persons].map(([k, v]) => [Number(k.slice(1)), v.theta] as const);
    expect(corr(persons.map(([k]) => trueTheta[k]), persons.map(([, t]) => t))).toBeGreaterThan(0.85);
    // markazlashtirilgan
    const meanB = items.reduce((s, [, b]) => s + b, 0) / items.length;
    expect(Math.abs(meanB)).toBeLessThan(1e-6);
    // qiyin savol (b katta) — to'g'ri javob ulushi kichik
    const hardest = [...r.items.values()].sort((a, c) => c.b - a.b)[0];
    const easiest = [...r.items.values()].sort((a, c) => a.b - c.b)[0];
    expect(hardest.pValue).toBeLessThan(easiest.pValue);
  });

  it("ekstremal savol va o'quvchilar chiqariladi; takroriy javob — faqat birinchisi", () => {
    const data: Response[] = [
      { person: "a", item: "hamma", correct: true },
      { person: "b", item: "hamma", correct: true },
      { person: "a", item: "x", correct: true },
      { person: "a", item: "y", correct: false },
      { person: "b", item: "x", correct: false },
      { person: "b", item: "y", correct: true },
      { person: "b", item: "y", correct: false }, // takror — e'tiborsiz
      { person: "c", item: "x", correct: true },
      { person: "c", item: "y", correct: true }, // c hammasini to'g'ri — chiqariladi
    ];
    const r = estimateRasch(data);
    expect(r.excluded.items).toContain("hamma");
    expect(r.excluded.persons).toContain("c");
    expect(r.items.has("x") && r.items.has("y")).toBe(true);
  });

  it("minPerItem: kam javobli savollar baholanmaydi", () => {
    const { data } = simulate(200, 20, 0.5, 7);
    const extra: Response[] = [{ person: "p0", item: "yangi", correct: true }, { person: "p1", item: "yangi", correct: false }];
    const r = estimateRasch([...data, ...extra], { minPerItem: 30 });
    expect(r.items.has("yangi")).toBe(false);
    expect(r.excluded.items).toContain("yangi");
  });
});

describe("difficultyBands", () => {
  it("10/18/7 ulushida toifalarga ajratadi", () => {
    const bs = Array.from({ length: 350 }, (_, i) => i / 10 - 17.5);
    const bands = difficultyBands(bs);
    const counts = [0, 0, 0, 0];
    for (const b of bs) counts[bandOf(b, bands)]++;
    expect(counts[1]).toBe(100);
    expect(counts[2]).toBe(180);
    expect(counts[3]).toBe(70);
  });
});

describe("itemDiscrimination", () => {
  it("javob kaliti teskari savol manfiy korrelyatsiya beradi", async () => {
    const { itemDiscrimination } = await import("@/lib/rasch");
    const { data } = simulate(500, 30, 0.6, 11);
    // 0-savolning kaliti "xato": natijani teskari qilamiz
    const flipped = data.map((r) => (r.item === 0 ? { ...r, correct: !r.correct } : r));
    const r = estimateRasch(flipped);
    const disc = itemDiscrimination(flipped, r.persons);
    expect(disc.get("0")!).toBeLessThan(0);
    const others = [...disc].filter(([k]) => k !== "0").map(([, v]) => v);
    expect(Math.min(...others)).toBeGreaterThan(0);
  });
});
