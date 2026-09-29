/**
 * Kirishdan keyin qaytiladigan manzil. Faqat sayt ichidagi yo'l qabul qilinadi —
 * "//evil.com", "https://…", "/\evil" kabi tashqi yo'naltirishlar /app ga almashtiriladi.
 */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "http://x.local");
    return url.origin === "http://x.local" ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
