// Yuristlar katalogi: profil shakli, kontaktlarni yashirish, ko'rinish yordamchilari. Sof funksiyalar.
import { z } from "zod";
import { REGIONS } from "@/app/app/profil/regions";

export { REGIONS };

export const LANGUAGES = { uz: "O'zbekcha", ru: "Ruscha", en: "Inglizcha", kk: "Qoraqalpoqcha" } as const;

const opt = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" || v == null ? null : v), s.nullable());

export const LawyerProfileSchema = z.object({
  display_name: z.string().trim().min(3, "Ism-familiyani yozing").max(80),
  headline: opt(z.string().trim().max(120)),
  bio: opt(z.string().trim().max(2000, "Tavsif 2000 belgidan oshmasin")),
  fields: z.array(z.string().regex(/^[a-z-]{2,40}$/)).min(1, "Kamida bitta sohani tanlang").max(6, "Ko'pi bilan 6 ta soha"),
  region: opt(z.enum(REGIONS as unknown as [string, ...string[]])),
  experience_years: opt(z.coerce.number().int().min(0).max(70)),
  languages: z.array(z.enum(Object.keys(LANGUAGES) as [keyof typeof LANGUAGES, ...(keyof typeof LANGUAGES)[]])).min(1).max(4),
  price_from_uzs: opt(z.coerce.number().int().min(0).max(100_000_000)),
  phone: opt(z.string().trim().transform((s) => s.replace(/[\s()-]/g, "")).pipe(z.string().regex(/^\+998\d{9}$/, "Telefon: +998 XX XXX XX XX"))),
  telegram: opt(z.string().trim().transform((s) => s.replace(/^@|^https?:\/\/t\.me\//, "")).pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/, "Telegram username noto'g'ri"))),
  payout_card: opt(z.string().transform((s) => s.replace(/\s/g, "")).pipe(z.string().regex(/^\d{16}$/, "Karta raqami 16 ta raqam"))),
  payout_holder: opt(z.string().trim().max(80)),
  hidden: z.boolean().default(false),
});
export type LawyerProfileInput = z.infer<typeof LawyerProfileSchema>;

export const ReportSchema = z.string().trim().min(10, "Shikoyatni batafsilroq yozing (kamida 10 belgi)").max(1000);
export const LicenseSchema = z.string().trim().min(3, "Guvohnoma raqamini yozing").max(40);

export type LawyerCard = {
  id: string; display_name: string; headline: string | null; bio: string | null; fields: string[]; region: string | null;
  experience_years: number | null; languages: string[]; price_from_uzs: number | null; verified: boolean;
  rating: number | null; rating_count: number; has_contacts: boolean; since: string; status?: "active" | "hidden" | "blocked";
};

const MASK = "••• (kontakt to'lovdan keyin ochiladi)";

/**
 * To'lovgacha yozishmada kontaktlar yashiriladi — platformani chetlab o'tishning oldini olish.
 * Telefon (+998…, 9+ raqam, bo'shliq/chiziqcha bilan), @username, t.me havolalari, email.
 */
export function maskContacts(text: string): { text: string; masked: boolean } {
  let masked = false;
  const hit = () => ((masked = true), MASK);
  const out = text
    .replace(/(?:https?:\/\/)?(?:t\.me|telegram\.me|wa\.me)\/\S+/gi, hit)
    .replace(/[\w.+-]+@[\w-]+\.[\w.]{2,}/g, hit)
    .replace(/(?<![\w])@[A-Za-z0-9_]{4,32}\b/g, hit)
    .replace(/(?:\+|\b)(?:\d[\s().-]{0,2}){8,13}\d\b/g, hit);
  return { text: out, masked };
}

export const fmtSum = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} so'm`;

export function experienceLabel(y: number | null): string | null {
  if (y == null) return null;
  return y === 0 ? "Tajriba: 1 yilgacha" : `Tajriba: ${y} yil`;
}
