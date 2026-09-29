import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { isSameOrigin } from "@/lib/supabase/cookies";
import { createSupabase } from "@/lib/supabase/server";

/** Chiqish — faqat POST (GET bilan chiqarib yuborish "CSRF" orqali suiiste'mol qilinmasin). */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request, env().NEXT_PUBLIC_SITE_URL)) return new NextResponse("origin", { status: 403 });
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
