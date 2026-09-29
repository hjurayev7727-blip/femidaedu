import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env, serverEnv } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

/** So'rov egasi nomidan ishlaydigan klient (RLS amal qiladi). Har so'rovda yangisi yaratiladi. */
export async function createSupabase() {
  const cookieStore = await cookies();
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL } = env();
  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(NEXT_PUBLIC_SITE_URL),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component ichida cookie yozib bo'lmaydi — sessiyani proxy.ts yangilaydi.
        }
      },
    },
  });
}

/**
 * RLS'ni chetlab o'tadigan admin klient (maxfiy kalit). FAQAT server kodida,
 * foydalanuvchi huquqi oldindan tekshirilgandan keyin ishlatilsin.
 */
export function createSupabaseAdmin() {
  const { NEXT_PUBLIC_SUPABASE_URL } = env();
  return createClient(NEXT_PUBLIC_SUPABASE_URL, serverEnv().SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
