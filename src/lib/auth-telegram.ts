import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { displayName, type TelegramUser } from "@/lib/telegram";

/**
 * Supabase Telegram'ni o'zi qo'llab-quvvatlamaydi. Shuning uchun:
 *   1) Telegram imzosi serverda tekshiriladi (lib/telegram.ts);
 *   2) telegram_id bo'yicha profil topiladi yoki yangi foydalanuvchi yaratiladi
 *      (texnik email bilan — foydalanuvchiga ko'rinmaydi, xat yuborilmaydi);
 *   3) admin API orqali bir martalik token olinib, verifyOtp bilan cookie sessiya ochiladi.
 */
const TECH_EMAIL_DOMAIN = "telegram.aplus-huquq.uz";

/** Profil sahifasida "Telegram'ni bog'lash" bosilganda qo'yiladi (qiymati — user id, 10 daqiqa). */
export const LINK_COOKIE = "tg_link";

export function technicalEmail(telegramId: number) {
  return `tg${telegramId}@${TECH_EMAIL_DOMAIN}`;
}

export function isTechnicalEmail(email: string | null | undefined) {
  return Boolean(email?.endsWith(`@${TECH_EMAIL_DOMAIN}`));
}

export type TelegramLinkResult =
  | { ok: true; email: string; created: boolean }
  | { ok: false; reason: "taken" | "error"; message?: string };

/** Telegram hisobiga mos Supabase foydalanuvchisining emailini qaytaradi (kerak bo'lsa yaratadi). */
export async function resolveTelegramUser(admin: SupabaseClient, tg: TelegramUser): Promise<TelegramLinkResult> {
  const existing = await admin.from("profiles").select("id").eq("telegram_id", tg.id).maybeSingle();
  if (existing.error) return { ok: false, reason: "error", message: existing.error.message };

  if (existing.data) {
    const { data, error } = await admin.auth.admin.getUserById(existing.data.id);
    if (error || !data.user?.email) return { ok: false, reason: "error", message: error?.message };
    await admin.from("profiles").update({ telegram_username: tg.username ?? null }).eq("id", existing.data.id);
    return { ok: true, email: data.user.email, created: false };
  }

  const email = technicalEmail(tg.id);
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: displayName(tg),
      avatar_url: tg.photo_url,
      telegram_id: String(tg.id),
      telegram_username: tg.username,
      provider: "telegram",
    },
  });
  // Bir vaqtda ikki marta bosilsa — ikkinchisi "allaqachon mavjud" oladi, bu xato emas
  if (error && !/already|exists|registered/i.test(error.message)) {
    return { ok: false, reason: "error", message: error.message };
  }
  return { ok: true, email, created: !error };
}

/** Kirgan foydalanuvchiga (masalan, Google orqali) Telegram hisobini bog'laydi. */
export async function linkTelegram(admin: SupabaseClient, userId: string, tg: TelegramUser): Promise<TelegramLinkResult> {
  const owner = await admin.from("profiles").select("id").eq("telegram_id", tg.id).maybeSingle();
  if (owner.error) return { ok: false, reason: "error", message: owner.error.message };
  if (owner.data && owner.data.id !== userId) return { ok: false, reason: "taken" };

  const { error } = await admin
    .from("profiles")
    .update({ telegram_id: tg.id, telegram_username: tg.username ?? null })
    .eq("id", userId);
  return error ? { ok: false, reason: "error", message: error.message } : { ok: true, email: "", created: false };
}

/**
 * Telegram foydalanuvchisini tizimga kiritadi (kerak bo'lsa yaratadi) va cookie sessiyasini o'rnatadi.
 * `supabase` — so'rov cookie'lariga bog'langan klient, `admin` — maxfiy kalitli klient.
 */
export async function signInTelegramUser(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  tg: TelegramUser,
): Promise<{ ok: true } | { ok: false; step: string; message?: string }> {
  const resolved = await resolveTelegramUser(admin, tg);
  if (!resolved.ok) return { ok: false, step: "resolve", message: resolved.message };

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: resolved.email });
  if (linkError || !link.properties?.hashed_token) return { ok: false, step: "generateLink", message: linkError?.message };

  const { error: otpError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (otpError) return { ok: false, step: "verifyOtp", message: otpError.message };
  return { ok: true };
}
