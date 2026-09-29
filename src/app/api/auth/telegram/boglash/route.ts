import { NextResponse, type NextRequest } from "next/server";
import { LINK_COOKIE } from "@/lib/auth-telegram";
import { env } from "@/lib/env";
import { isSameOrigin } from "@/lib/supabase/cookies";
import { createSupabase } from "@/lib/supabase/server";

/** Profil sahifasidagi forma: Telegram'ni bog'lash niyatini 10 daqiqaga belgilaydi. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request, env().NEXT_PUBLIC_SITE_URL)) return new NextResponse("origin", { status: 403 });
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL("/kirish", request.nextUrl.origin), { status: 303 });

  const res = NextResponse.redirect(new URL("/app/profil?boglash=1", request.nextUrl.origin), { status: 303 });
  res.cookies.set(LINK_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/api/auth/telegram",
    maxAge: 600,
  });
  return res;
}
