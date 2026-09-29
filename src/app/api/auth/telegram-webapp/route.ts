import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { signInTelegramUser } from "@/lib/auth-telegram";
import { env, serverEnv } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { isSameOrigin } from "@/lib/supabase/cookies";
import { createSupabase, createSupabaseAdmin } from "@/lib/supabase/server";
import { verifyWebAppInitData } from "@/lib/telegram";

const Body = z.object({ initData: z.string().min(10).max(4096), keyin: z.string().max(300).optional() });

/** Telegram Mini App: initData imzosi tekshiriladi va foydalanuvchi tizimga kiritiladi. */
export async function POST(request: NextRequest) {
  // Login CSRF'dan himoya: faqat o'z saytimiz sahifasidan (/tg) kelgan so'rov
  if (!isSameOrigin(request, env().NEXT_PUBLIC_SITE_URL)) {
    return NextResponse.json({ ok: false, error: "origin" }, { status: 403 });
  }

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });

  const tg = verifyWebAppInitData(body.data.initData, serverEnv().TELEGRAM_BOT_TOKEN);
  if (!tg) return NextResponse.json({ ok: false, error: "signature" }, { status: 401 });

  const signed = await signInTelegramUser(await createSupabase(), createSupabaseAdmin(), tg);
  if (!signed.ok) {
    console.error(`webapp auth: ${signed.step}`, signed.message);
    return NextResponse.json({ ok: false, error: "server" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, next: safeNext(body.data.keyin) });
}
