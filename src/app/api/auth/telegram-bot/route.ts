import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signInTelegramUser } from "@/lib/auth-telegram";
import { BOT_LOGIN_COOKIE, BOT_LOGIN_TTL_SEC, botLoginLink, hashLoginToken, isLoginToken, newLoginToken } from "@/lib/bot-login";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { isSameOrigin } from "@/lib/supabase/cookies";
import { createSupabase, createSupabaseAdmin } from "@/lib/supabase/server";
import type { TelegramUser } from "@/lib/telegram";

const Body = z.object({ action: z.enum(["start", "check"]), keyin: z.string().max(300).optional() });
const COOKIE_PATH = "/api/auth/telegram-bot";

/**
 * Saytga bot orqali kirish.
 *  start — bir martalik kod yaratadi, uni shu brauzerning httpOnly cookie'siga yozadi va bot havolasini qaytaradi;
 *  check — cookie'dagi kod botda tasdiqlangan bo'lsa, uni ishlatib (bir marta) sessiya ochadi.
 * Kod havolada ham bo'ladi, lekin kirish faqat cookie egasiga — begona odam havolani ochib tasdiqlasa ham,
 * sessiya faqat kodni yaratgan brauzerda ochiladi.
 */
export async function POST(request: NextRequest) {
  const { NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: bot } = env();
  if (!isSameOrigin(request, NEXT_PUBLIC_SITE_URL)) return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  if (!bot) return NextResponse.json({ ok: false, error: "bot" }, { status: 503 });
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  const admin = createSupabaseAdmin();

  if (body.data.action === "start") {
    const token = newLoginToken();
    const { error } = await admin.from("bot_logins").insert({ token_hash: hashLoginToken(token) });
    if (error) {
      console.error("bot_logins insert", error.message);
      return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
    }
    const res = NextResponse.json({ ok: true, link: botLoginLink(bot, token) });
    res.cookies.set(BOT_LOGIN_COOKIE, token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: COOKIE_PATH,
      maxAge: BOT_LOGIN_TTL_SEC,
    });
    return res;
  }

  const token = request.cookies.get(BOT_LOGIN_COOKIE)?.value ?? "";
  if (!isLoginToken(token)) return NextResponse.json({ ok: false, state: "expired" });
  const hash = hashLoginToken(token);

  // Bir marta ishlatish: faqat tasdiqlangan, ishlatilmagan va muddati o'tmagan kod "used" bo'ladi
  const { data: used } = await admin
    .from("bot_logins")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", hash)
    .not("confirmed_at", "is", null)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("tg")
    .maybeSingle<{ tg: TelegramUser }>();

  if (!used) {
    const { data: row } = await admin.from("bot_logins").select("expires_at, used_at").eq("token_hash", hash).maybeSingle<{ expires_at: string; used_at: string | null }>();
    const alive = row && !row.used_at && new Date(row.expires_at).getTime() > Date.now();
    return NextResponse.json({ ok: false, state: alive ? "pending" : "expired" });
  }

  const signed = await signInTelegramUser(await createSupabase(), admin, used.tg);
  if (!signed.ok) {
    console.error(`bot login: ${signed.step}`, signed.message);
    return NextResponse.json({ ok: false, state: "error" }, { status: 500 });
  }
  // Foydalanuvchi botni ochdi — eslatmalar yoqiladi
  await admin.from("profiles").update({ bot_enabled: true }).eq("telegram_id", used.tg.id);
  const res = NextResponse.json({ ok: true, next: safeNext(body.data.keyin) });
  res.cookies.set(BOT_LOGIN_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return res;
}
