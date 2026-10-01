// Yuristlar katalogi (pivot, 4-bosqich): sof funksiyalar — profil sxemasi, kontaktlarni aniqlash va yashirish.
import { z } from "zod";
import { REGIONS } from "@/app/app/profil/regions";

export const LAWYER_KIND = { advokat: "Advokat", yurist: "Yurist" } as const;
export type LawyerKind = keyof typeof LAWYER_KIND;

export const LAWYER_LANG = { uz: "O'zbekcha", ru: "Ruscha", en: "Inglizcha", kaa: "Qoraqalpoqcha" } as const;
export type LawyerLang = keyof typeof LAWYER_LANG;

export const REPORT_KIND = {
  fake: "Soxta profil yoki malakasi yo'q",
  fraud: "Firibgarlik: pul oldi, xizmat ko'rsatmadi",
  offplatform: "Platformadan tashqarida to'lov so'radi",
  rude: "Hurmatsiz muomala",
  other: "Boshqa",
} as const;
export type ReportKind = keyof typeof REPORT_KIND;

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export const MAX_LAWYER_FIELDS = 5;
export const LICENSE_MAX_BYTES = 5 * 1024 * 1024;
export const LAWYER_DOCS_BUCKET = "lawyer-docs";
/** Katalog sahifasidagi yuristlar soni */
export const CATALOG_PAGE = 20;

/** Kontakt o'rniga ko'rsatiladigan matn (5-bosqich chatida ham) */
export const CONTACT_MASK = "••• (to'lovdan keyin)";

// Tartib muhim: avval email (ichida @ bor), keyin havolalar, keyin @username, oxirida telefon raqamlari.
const CONTACT_PATTERNS: { re: RegExp; keepPrefix?: boolean }[] = [
  { re: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { re: /\b(?:https?:\/\/|www\.)\S+|\b(?:t(?:elegram)?\.me|wa\.me|instagram\.com|facebook\.com|fb\.com|vk\.com)\/\S*/gi },
  { re: /(^|[^\w@])@[A-Za-z][A-Za-z0-9_]{3,31}\b/g, keepPrefix: true },
  // 9 va undan ko'p raqam (bo'shliq, chiziqcha, qavs, nuqta bilan): +998 90 123-45-67, (90) 1234567, 901234567
  { re: /\+?\(?\d(?:[\s\-().]{0,2}\d){8,}/g },
];

/** Matndagi kontaktlar (telefon, @username, t.me, email, havola) — topilganlari */
export function findContacts(text: string): string[] {
  const found: string[] = [];
  let rest = text;
  for (const { re, keepPrefix } of CONTACT_PATTERNS) {
    rest = rest.replace(re, (m, prefix?: string) => {
      found.push((keepPrefix && typeof prefix === "string" ? m.slice(prefix.length) : m).trim());
      return keepPrefix && typeof prefix === "string" ? `${prefix} ` : " ";
    });
  }
  return found;
}

/** Kontaktlarni yashirish: to'lovgacha mijoz va yurist platformani chetlab o'tmasin */
export function maskContacts(text: string): string {
  let out = text;
  for (const { re, keepPrefix } of CONTACT_PATTERNS) {
    out = out.replace(re, (_m, prefix?: string) => (keepPrefix && typeof prefix === "string" ? prefix + CONTACT_MASK : CONTACT_MASK));
  }
  return out;
}

/** "+998 (90) 123-45-67", "998901234567", "901234567" → "+998901234567"; bo'sh → null; noto'g'ri → undefined */
export function normalizePhone(raw: string): string | null | undefined {
  const d = raw.replace(/[\s\-().]/g, "");
  if (!d) return null;
  const m = d.match(/^(?:\+?998)?(\d{9})$/);
  return m ? `+998${m[1]}` : undefined;
}

/** "@ism_familiya", "t.me/ism_familiya", "https://t.me/ism_familiya" → "ism_familiya"; bo'sh → null; noto'g'ri → undefined */
export function normalizeTelegram(raw: string): string | null | undefined {
  const s = raw.trim().replace(/^(?:https?:\/\/)?(?:t\.me|telegram\.me)\//i, "").replace(/^@/, "");
  if (!s) return null;
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s) ? s : undefined;
}

export const LawyerProfileSchema = z.object({
  kind: z.enum(Object.keys(LAWYER_KIND) as [LawyerKind, ...LawyerKind[]], { error: "Turini tanlang" }),
  display_name: z.string().trim().min(3, "Ism-familiya kamida 3 harf").max(80, "Ism-familiya 80 belgidan oshmasin"),
  headline: z.string().trim().max(120, "Qisqa tavsif 120 belgidan oshmasin").default(""),
  bio: z.string().trim().max(2000, "Batafsil ma'lumot 2000 belgidan oshmasin").default(""),
  fields: z.array(z.string().regex(/^[a-z-]{2,40}$/)).min(1, "Kamida bitta sohani tanlang").max(MAX_LAWYER_FIELDS, `Ko'pi bilan ${MAX_LAWYER_FIELDS} ta soha`),
  region: z.enum(REGIONS, { error: "Viloyatni tanlang" }),
  experience_years: z.coerce.number({ error: "Tajriba yillarini raqam bilan yozing" }).int().min(0).max(60, "Tajriba 60 yildan oshmasin"),
  languages: z.array(z.enum(Object.keys(LAWYER_LANG) as [LawyerLang, ...LawyerLang[]])).min(1, "Kamida bitta tilni tanlang").max(4),
  price_from_uzs: z.number().int().min(10_000, "Narx kamida 10 000 so'm").max(100_000_000).nullable(),
  phone: z.string().max(30).refine((s) => normalizePhone(s) !== undefined, "Telefon raqami: +998 XX XXX XX XX").transform((s) => normalizePhone(s) ?? null),
  telegram: z.string().max(60).refine((s) => normalizeTelegram(s) !== undefined, "Telegram: @username (5–32 belgi)").transform((s) => normalizeTelegram(s) ?? null),
  visible: z.boolean(),
})
  .refine((p) => Boolean(p.phone || p.telegram), { message: "Telefon yoki Telegram'dan kamida bittasini kiriting (mijozga to'lovdan keyin ko'rinadi)", path: ["phone"] })
  .superRefine((p, ctx) => {
    for (const [key, label] of [["display_name", "Ism-familiya"], ["headline", "Qisqa tavsif"], ["bio", "Batafsil ma'lumot"]] as const) {
      if (findContacts(p[key]).length) {
        ctx.addIssue({ code: "custom", path: [key], message: `${label}: telefon, Telegram, email yoki havola yozmang — kontaktlar mijozga to'lovdan keyin ochiladi` });
      }
    }
  });
export type LawyerProfileInput = z.infer<typeof LawyerProfileSchema>;

/** Kabinet formasi → sxema kirishi */
export function lawyerFormInput(form: FormData) {
  const price = String(form.get("price_from_uzs") ?? "").replace(/[\s,.]/g, "");
  return {
    kind: form.get("kind"),
    display_name: String(form.get("display_name") ?? ""),
    headline: String(form.get("headline") ?? ""),
    bio: String(form.get("bio") ?? ""),
    fields: form.getAll("fields").map(String),
    region: form.get("region"),
    experience_years: String(form.get("experience_years") ?? "0") || "0",
    languages: form.getAll("languages").map(String),
    price_from_uzs: price ? Number(price) : null,
    phone: String(form.get("phone") ?? ""),
    telegram: String(form.get("telegram") ?? ""),
    visible: form.get("visible") === "on",
  };
}

export const ReportSchema = z.object({
  lawyer: z.uuid(),
  kind: z.enum(Object.keys(REPORT_KIND) as [ReportKind, ...ReportKind[]], { error: "Sababni tanlang" }),
  reason: z.string().trim().min(10, "Batafsil yozing (kamida 10 belgi)").max(1000, "1000 belgidan oshmasin"),
});

export const LicenseSchema = z.string().trim().min(3, "Guvohnoma yoki litsenziya raqamini yozing").max(40, "Raqam 40 belgidan oshmasin");

/** Tajriba: "7 yil tajriba" / "Tajriba 1 yildan kam" */
export const experienceLabel = (years: number) => (years > 0 ? `${years} yil tajriba` : "Tajriba 1 yildan kam");

/** Telefonni ko'rsatish: +998 90 123 45 67 */
export const formatPhone = (p: string) => p.replace(/^\+998(\d{2})(\d{3})(\d{2})(\d{2})$/, "+998 $1 $2 $3 $4");
