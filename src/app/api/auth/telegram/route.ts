import { NextResponse, type NextRequest } from "next/server";
import { LINK_COOKIE, linkTelegram, signInTelegramUser } from "@/lib/auth-telegram";
import { serverEnv } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { secretEquals } from "@/lib/secure-compare";
import { createSupabase, createSupabaseAdmin } from "@/lib/supabase/server";
import { verifyLoginWidget } from "@/lib/telegram";

const STATE_COOKIE = "tg_state"; // components/telegram-login.tsx bilan bir xil

/**
 * Telegram Login Widget shu manzilga yo'naltiradi (data-auth-url).
 * Kirmagan bo'lsa — kiritadi; kirgan bo'lsa — joriy akkauntga Telegram'ni bog'laydi.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("keyin"));
  const fail = (code: string) => NextResponse.redirect(new URL(`/kirish?xato=${code}`, url.origin));

  // Login CSRF: faqat shu brauzerda boshlangan kirish (widget sahifasi qo'ygan state cookie) qabul qilinadi
  const state = url.searchParams.get("s");
  if (!state || !secretEquals(request.cookies.get(STATE_COOKIE)?.value, state)) return fail("sessiya");

  const tg = verifyLoginWidget(url.searchParams, serverEnv().TELEGRAM_BOT_TOKEN);
  if (!tg) return fail("telegram_imzo");

  const supabase = await createSupabase();
  const admin = createSupabaseAdmin();

  const { data: claims } = await supabase.auth.getClaims();
  const currentUserId = claims?.claims?.sub;
  if (currentUserId) {
    // Bog'lash faqat foydalanuvchi profil sahifasida o'zi boshlagan bo'lsa (LINK_COOKIE).
    // Aks holda begona imzoli havola orqali hujumchi o'z Telegram'ini bog'lab, akkauntni egallardi.
    if (request.cookies.get(LINK_COOKIE)?.value !== currentUserId) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    const linked = await linkTelegram(admin, currentUserId, tg);
    const status = linked.ok ? "ok" : linked.reason === "taken" ? "band" : "xato";
    const res = NextResponse.redirect(new URL(`/app/profil?telegram=${status}`, url.origin));
    res.cookies.set(LINK_COOKIE, "", { path: "/api/auth/telegram", maxAge: 0 });
    return res;
  }

  const signed = await signInTelegramUser(supabase, admin, tg);
  if (!signed.ok) {
    console.error(`telegram auth: ${signed.step}`, signed.message);
    return fail("server");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
