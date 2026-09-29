"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { REGIONS } from "./regions";

const ProfileInput = z.object({
  full_name: z.string().trim().min(2, "Ism kamida 2 harf").max(80),
  goal: z.enum(["abituriyent", "oqituvchi", "boshqa"]).nullable(),
  region: z.enum(REGIONS).nullable(),
  script: z.enum(["latin", "cyrillic"]),
});

export type SaveState = { ok: boolean; message: string } | null;

export async function saveProfile(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, userId } = await requireUser();
  const parsed = ProfileInput.safeParse({
    full_name: form.get("full_name"),
    goal: form.get("goal") || null,
    region: form.get("region") || null,
    script: form.get("script"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };

  // RLS + ustun GRANT'lari: foydalanuvchi faqat shu 4 ustunni va faqat o'z profilini o'zgartira oladi
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", userId);
  if (error) return { ok: false, message: "Saqlab bo'lmadi, qayta urinib ko'ring" };

  revalidatePath("/app", "layout");
  return { ok: true, message: "Saqlandi" };
}

export async function saveNotifications(form: FormData): Promise<void> {
  const { supabase, userId } = await requireUser();
  // Ustun GRANT'i: foydalanuvchi faqat notify_* ni o'zgartira oladi (bot_enabled — server)
  await supabase
    .from("profiles")
    .update({ notify_morning: form.get("notify_morning") === "on", notify_evening: form.get("notify_evening") === "on" })
    .eq("id", userId);
  revalidatePath("/app/profil");
}

export async function saveLeaderboardVisibility(form: FormData): Promise<void> {
  const { supabase, userId } = await requireUser();
  await supabase.from("profiles").update({ leaderboard_visible: form.get("visible") === "on" }).eq("id", userId);
  revalidatePath("/app/profil");
}
