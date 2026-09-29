import { z } from "zod";

// Brauzerga ham chiqadigan (NEXT_PUBLIC_) o'zgaruvchilar. Next.js ularni build vaqtida
// matnga almashtiradi, shuning uchun har birini to'liq nomi bilan yozish shart.
const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: z.string().min(3).optional(),
  })
  .safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
    NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || undefined,
  });

/** Supabase sozlanganmi? Sozlanmagan bo'lsa sahifalar "sozlash kerak" holatini ko'rsatadi. */
export const isConfigured = publicEnv.success;

export function env() {
  if (!publicEnv.success) {
    throw new Error(
      "Supabase sozlanmagan: .env.local faylida NEXT_PUBLIC_SUPABASE_URL va NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ni to'ldiring (README.md).",
    );
  }
  return publicEnv.data;
}

/** Faqat serverda ishlatiladigan maxfiy kalitlar. */
export function serverEnv() {
  return z
    .object({
      SUPABASE_SECRET_KEY: z.string().min(20),
      TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/, "Bot token formati: 123456:ABC…"),
    })
    .parse({
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    });
}

/** Bot webhook va cron uchun maxfiy qiymatlar (ixtiyoriy — sozlanmagan bo'lsa marshrutlar 503 qaytaradi) */
export function botEnv() {
  const parsed = z
    .object({
      TELEGRAM_BOT_TOKEN: z.string().regex(/^\d+:[\w-]+$/),
      TELEGRAM_WEBHOOK_SECRET: z.string().regex(/^[A-Za-z0-9_-]{24,256}$/, "24+ belgi: harf, raqam, _ yoki -"),
    })
    .safeParse({ TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET });
  return parsed.success ? parsed.data : null;
}

export function cronSecret(): string | null {
  const s = process.env.CRON_SECRET;
  return s && s.length >= 24 ? s : null;
}
