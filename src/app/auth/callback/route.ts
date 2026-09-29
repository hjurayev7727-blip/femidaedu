import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/redirect";
import { createSupabase } from "@/lib/supabase/server";

/** Google OAuth (PKCE) qaytish manzili: kodni sessiyaga almashtiradi. */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("keyin"));

  if (code) {
    const supabase = await createSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("oauth callback", error.message);
  }
  return NextResponse.redirect(new URL("/kirish?xato=google", url.origin));
}
