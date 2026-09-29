"use client";
import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/supabase/cookies";

export function createSupabaseBrowser() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SITE_URL } = env();
  return createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: sessionCookieOptions(NEXT_PUBLIC_SITE_URL),
  });
}
