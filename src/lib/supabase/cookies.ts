import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Sessiya cookie parametrlari.
 * Telegram Web (web.telegram.org) Mini App'ni iframe ichida ochadi — u yerda saytimiz "uchinchi tomon",
 * va SameSite=Lax cookie'lar yuborilmaydi (kirish muvaffaqiyatli, lekin keyingi sahifa sessiyasiz qoladi).
 * Shuning uchun HTTPS'da SameSite=None + Partitioned (CHIPS): Chrome uchinchi tomon cookie'larini
 * bloklaganda ham iframe ichida alohida "bo'lim"da saqlanadi; oddiy tashrifda odatdagidek ishlaydi.
 * Cross-site cookie bo'lgani uchun holat o'zgartiruvchi POST yo'llar Origin'ni tekshiradi (isSameOrigin).
 * Lokal http://localhost da Secure cookie yozilmaydi — u yerda standart parametrlar.
 */
export function sessionCookieOptions(siteUrl: string): CookieOptionsWithName {
  return siteUrl.startsWith("https://") ? { sameSite: "none", secure: true, partitioned: true } : {};
}

/** POST so'rov o'z saytimiz sahifasidan kelganmi (login/logout CSRF himoyasi). */
export function isSameOrigin(request: Request, siteUrl: string) {
  const origin = request.headers.get("origin");
  return origin !== null && (origin === new URL(siteUrl).origin || origin === new URL(request.url).origin);
}
