import { createHash, timingSafeEqual } from "node:crypto";

/** Maxfiy qiymatlarni vaqtga chidamli solishtirish (uzunlik ham sizib chiqmaydi) */
export function secretEquals(given: string | null | undefined, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
