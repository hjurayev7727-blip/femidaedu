import { NextResponse, type NextRequest } from "next/server";
import { createSupabase, createSupabaseAdmin } from "@/lib/supabase/server";

/** Bot/Mini App havolasi: bugungi kunlik testni ochadi (kuniga bitta — takror bosish o'sha urinishga olib boradi). */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return NextResponse.redirect(new URL(`/kirish?keyin=${encodeURIComponent("/api/kunlik")}`, origin));

  const { data: attemptId, error } = await createSupabaseAdmin().rpc("start_daily", { p_user: userId });
  if (error) return NextResponse.redirect(new URL("/app?xato=kunlik", origin));
  return NextResponse.redirect(new URL(`/app/mashq/s/${attemptId as string}`, origin));
}
