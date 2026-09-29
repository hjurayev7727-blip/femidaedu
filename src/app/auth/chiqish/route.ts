import { NextResponse, type NextRequest } from "next/server";
import { createSupabase } from "@/lib/supabase/server";

/** Chiqish — faqat POST (GET bilan chiqarib yuborish "CSRF" orqali suiiste'mol qilinmasin). */
export async function POST(request: NextRequest) {
  const supabase = await createSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), { status: 303 });
}
