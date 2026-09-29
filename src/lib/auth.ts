import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabase } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "student" | "teacher" | "author" | "reviewer" | "admin";
  goal: "abituriyent" | "oqituvchi" | "boshqa" | null;
  region: string | null;
  script: "latin" | "cyrillic";
  telegram_id: number | null;
  telegram_username: string | null;
  streak_days: number;
  streak_best: number;
  last_active_on: string | null;
  bot_enabled: boolean;
  notify_morning: boolean;
  notify_evening: boolean;
  leaderboard_visible: boolean;
};

/**
 * Joriy foydalanuvchi va profili. Kirmagan bo'lsa /kirish ga yo'naltiradi.
 * proxy.ts dagi tekshiruv optimistik — haqiqiy tekshiruv shu yerda (JWT imzosi bilan).
 */
export const requireUser = cache(async () => {
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/kirish");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, role, goal, region, script, telegram_id, telegram_username, streak_days, streak_best, last_active_on, bot_enabled, notify_morning, notify_evening, leaderboard_visible")
    .eq("id", userId)
    .single<Profile>();
  if (error || !profile) throw new Error(`Profil topilmadi: ${error?.message ?? userId}`);

  return { supabase, userId, email: (data.claims.email as string | undefined) ?? null, profile };
});

export async function requireRole(...roles: Profile["role"][]) {
  const ctx = await requireUser();
  if (!roles.includes(ctx.profile.role)) redirect("/app");
  return ctx;
}
