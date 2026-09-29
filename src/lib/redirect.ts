/**
 * Kirishdan keyin qaytiladigan manzil. Faqat sayt ichidagi yo'l qabul qilinadi —
 * "//evil.com", "https://…", "/\evil" va normallashtirilgandan keyin "//" ga aylanadiganlar
 * ("/.//evil.com", "/a/..//evil.com") /app ga almashtiriladi.
 */
export function safeNext(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const url = new URL(value, "http://x.local");
    if (url.origin !== "http://x.local") return fallback;
    // nuqta-segmentlar normallashgandan keyin ham protokolsiz tashqi manzil bo'lib qolmasin
    if (url.pathname.startsWith("//") || url.pathname.includes("\\")) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
