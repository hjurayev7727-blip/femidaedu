// Rasch (1PL IRT) modeli: P(to'g'ri) = 1 / (1 + e^-(θ - b)).
// θ — o'quvchi qobiliyati, b — savol qiyinligi (logit). JMLE (joint maximum likelihood) bilan baholanadi.

export type Response = { person: string; item: string | number; correct: boolean };

export type RaschResult = {
  items: Map<string, { b: number; se: number; n: number; pValue: number }>;
  persons: Map<string, { theta: number; n: number }>;
  iterations: number;
  converged: boolean;
  /** hammasi to'g'ri / hammasi xato bo'lgani uchun baholanmaganlar */
  excluded: { items: string[]; persons: string[] };
};

const clamp = (x: number, lim: number) => Math.max(-lim, Math.min(lim, x));
const p = (theta: number, b: number) => 1 / (1 + Math.exp(-(theta - b)));

/**
 * Ekstremal (hammasi to'g'ri yoki hammasi xato) o'quvchi va savollar iterativ chiqariladi —
 * ular uchun cheklangan baho mavjud emas. Qiyinliklar o'rtachasi 0 ga markazlashtiriladi.
 */
export function estimateRasch(data: Response[], opts: { maxIter?: number; tol?: number; minPerItem?: number } = {}): RaschResult {
  const maxIter = opts.maxIter ?? 100;
  const tol = opts.tol ?? 1e-4;
  const minPerItem = opts.minPerItem ?? 1;

  // Bir o'quvchi — bir savolga bitta (birinchi) javob
  const seen = new Set<string>();
  let rows = data.filter((r) => {
    const k = `${r.person}\u0000${r.item}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((r) => ({ person: r.person, item: String(r.item), correct: r.correct }));

  const excluded = { items: new Set<string>(), persons: new Set<string>() };
  for (let changed = true; changed; ) {
    changed = false;
    const byItem = new Map<string, { n: number; s: number }>();
    const byPerson = new Map<string, { n: number; s: number }>();
    for (const r of rows) {
      const i = byItem.get(r.item) ?? { n: 0, s: 0 };
      i.n++;
      i.s += r.correct ? 1 : 0;
      byItem.set(r.item, i);
      const q = byPerson.get(r.person) ?? { n: 0, s: 0 };
      q.n++;
      q.s += r.correct ? 1 : 0;
      byPerson.set(r.person, q);
    }
    const badItems = new Set([...byItem].filter(([, v]) => v.s === 0 || v.s === v.n || v.n < minPerItem).map(([k]) => k));
    const badPersons = new Set([...byPerson].filter(([, v]) => v.s === 0 || v.s === v.n).map(([k]) => k));
    if (badItems.size || badPersons.size) {
      badItems.forEach((k) => excluded.items.add(k));
      badPersons.forEach((k) => excluded.persons.add(k));
      rows = rows.filter((r) => !badItems.has(r.item) && !badPersons.has(r.person));
      changed = true;
    }
  }

  const itemIdx = new Map<string, number>();
  const personIdx = new Map<string, number>();
  for (const r of rows) {
    if (!itemIdx.has(r.item)) itemIdx.set(r.item, itemIdx.size);
    if (!personIdx.has(r.person)) personIdx.set(r.person, personIdx.size);
  }
  const I = itemIdx.size;
  const P = personIdx.size;
  const obs = rows.map((r) => ({ i: itemIdx.get(r.item)!, j: personIdx.get(r.person)!, x: r.correct ? 1 : 0 }));
  const itemScore = new Float64Array(I);
  const itemN = new Float64Array(I);
  const personScore = new Float64Array(P);
  const personN = new Float64Array(P);
  for (const o of obs) {
    itemScore[o.i] += o.x;
    itemN[o.i]++;
    personScore[o.j] += o.x;
    personN[o.j]++;
  }

  // Boshlang'ich qiymatlar — logit(ulush)
  const b = Float64Array.from({ length: I }, (_, i) => Math.log((itemN[i] - itemScore[i]) / itemScore[i]));
  const theta = Float64Array.from({ length: P }, (_, j) => Math.log(personScore[j] / (personN[j] - personScore[j])));

  let iterations = 0;
  let converged = false;
  for (; iterations < maxIter && I > 0 && P > 0; iterations++) {
    // θ — Nyuton qadami (b o'zgarmas)
    const tExp = new Float64Array(P);
    const tInfo = new Float64Array(P);
    for (const o of obs) {
      const pr = p(theta[o.j], b[o.i]);
      tExp[o.j] += pr;
      tInfo[o.j] += pr * (1 - pr);
    }
    for (let j = 0; j < P; j++) theta[j] += clamp((personScore[j] - tExp[j]) / Math.max(tInfo[j], 1e-9), 1);

    // b — Nyuton qadami (θ o'zgarmas)
    const bExp = new Float64Array(I);
    const bInfo = new Float64Array(I);
    for (const o of obs) {
      const pr = p(theta[o.j], b[o.i]);
      bExp[o.i] += pr;
      bInfo[o.i] += pr * (1 - pr);
    }
    let maxDelta = 0;
    for (let i = 0; i < I; i++) {
      const d = clamp((bExp[i] - itemScore[i]) / Math.max(bInfo[i], 1e-9), 1);
      b[i] += d;
      maxDelta = Math.max(maxDelta, Math.abs(d));
    }
    // markazlashtirish: o'rtacha qiyinlik = 0
    const mean = b.reduce((s, v) => s + v, 0) / I;
    for (let i = 0; i < I; i++) b[i] -= mean;
    for (let j = 0; j < P; j++) theta[j] -= mean;
    if (maxDelta < tol) {
      converged = true;
      iterations++;
      break;
    }
  }

  // Standart xato: 1/√(axborot)
  const info = new Float64Array(I);
  for (const o of obs) {
    const pr = p(theta[o.j], b[o.i]);
    info[o.i] += pr * (1 - pr);
  }

  const items = new Map<string, { b: number; se: number; n: number; pValue: number }>();
  for (const [k, i] of itemIdx) items.set(k, { b: b[i], se: 1 / Math.sqrt(Math.max(info[i], 1e-9)), n: itemN[i], pValue: itemScore[i] / itemN[i] });
  const persons = new Map<string, { theta: number; n: number }>();
  for (const [k, j] of personIdx) persons.set(k, { theta: theta[j], n: personN[j] });
  return { items, persons, iterations, converged, excluded: { items: [...excluded.items], persons: [...excluded.persons] } };
}

/**
 * Qiyinlikni sinov imtihoni toifasiga aylantiradi (1 — oson, 2 — o'rta, 3 — qiyin) —
 * shablondagi 10/18/7 ulushga mos bo'lsin deb kvantillar bo'yicha: pastki ~29% → 1, yuqori ~20% → 3.
 */
export function difficultyBands(bs: number[], mix: Record<string, number> = { "1": 10, "2": 18, "3": 7 }): { low: number; high: number } {
  const sorted = [...bs].sort((a, c) => a - c);
  const total = mix["1"] + mix["2"] + mix["3"];
  const q = (f: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * sorted.length)))];
  return { low: q(mix["1"] / total), high: q(1 - mix["3"] / total) };
}

export function bandOf(b: number, bands: { low: number; high: number }): 1 | 2 | 3 {
  return b < bands.low ? 1 : b >= bands.high ? 3 : 2;
}

/**
 * Savolning ajratish kuchi: to'g'ri/xato bilan o'quvchi qobiliyati (θ) orasidagi korrelyatsiya (point-biserial).
 * Manfiy qiymat — kuchli o'quvchilar xato, kuchsizlar "to'g'ri" javob bergan: ko'pincha javob kaliti xato.
 */
export function itemDiscrimination(data: Response[], persons: RaschResult["persons"]): Map<string, number> {
  const byItem = new Map<string, { x: number[]; t: number[] }>();
  const seen = new Set<string>();
  for (const r of data) {
    const k = `${r.person}\u0000${r.item}`;
    const person = persons.get(r.person);
    if (seen.has(k) || !person) continue;
    seen.add(k);
    const e = byItem.get(String(r.item)) ?? { x: [], t: [] };
    e.x.push(r.correct ? 1 : 0);
    e.t.push(person.theta);
    byItem.set(String(r.item), e);
  }
  const out = new Map<string, number>();
  for (const [item, { x, t }] of byItem) {
    const n = x.length;
    const mx = x.reduce((s, v) => s + v, 0) / n;
    const mt = t.reduce((s, v) => s + v, 0) / n;
    let sxt = 0, sxx = 0, stt = 0;
    for (let i = 0; i < n; i++) {
      sxt += (x[i] - mx) * (t[i] - mt);
      sxx += (x[i] - mx) ** 2;
      stt += (t[i] - mt) ** 2;
    }
    out.set(item, sxx && stt ? sxt / Math.sqrt(sxx * stt) : 0);
  }
  return out;
}
