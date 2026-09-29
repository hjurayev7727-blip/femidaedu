import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env, isConfigured } from "@/lib/env";
import { safeNext } from "@/lib/redirect";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

const PROTECTED = ["/app", "/ustoz", "/admin"];

/**
 * 1) Supabase sessiya tokenini yangilab, cookie'ga yozadi.
 * 2) Yopiq bo'limlarga kirmagan foydalanuvchini /kirish ga yo'naltiradi (optimistik tekshiruv —
 *    haqiqiy ruxsat har bir sahifa/amalda alohida tekshiriladi).
 */
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!isConfigured) {
    // Supabase hali ulanmagan — yopiq bo'limlar o'rniga kirish sahifasidagi sozlash eslatmasi
    return isProtected ? NextResponse.redirect(new URL("/kirish", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL } = env();

  const supabase = createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(NEXT_PUBLIC_SITE_URL),
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getClaims() JWT imzosini tekshiradi; getSession() dan farqli ravishda ishonchli
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/kirish";
    url.search = `?keyin=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
  if (signedIn && path === "/kirish") {
    // Kirgan foydalanuvchi: so'ralgan sahifaga (keyin), bo'lmasa /app ga
    const target = safeNext(request.nextUrl.searchParams.get("keyin") ?? undefined);
    return NextResponse.redirect(new URL(target.startsWith("/kirish") ? "/app" : target, request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
