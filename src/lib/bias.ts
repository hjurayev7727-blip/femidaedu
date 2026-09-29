// Kontent sifati: to'g'ri javob boshqa variantlardan keskin uzun bo'lsa, o'quvchi uni bilmasdan "taxmin" qila oladi.

export type LengthBias = { biased: boolean; ratio: number; correctLen: number; maxOtherLen: number };

/** To'g'ri variant eng uzun va boshqalardan kamida 30% hamda 8 belgi uzun bo'lsa — ko'zga tashlanadi */
export function longestOptionBias(options: string[], correctIndex: number): LengthBias {
  const lens = options.map((o) => o.trim().length);
  const correctLen = lens[correctIndex] ?? 0;
  const maxOtherLen = Math.max(0, ...lens.filter((_, i) => i !== correctIndex));
  const ratio = maxOtherLen ? correctLen / maxOtherLen : 1;
  return { biased: correctLen > maxOtherLen && ratio >= 1.3 && correctLen - maxOtherLen >= 8, ratio, correctLen, maxOtherLen };
}
