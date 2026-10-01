// "Savol bering" (pivot, 3-bosqich): huquqiy savol-javob va hujjat tahlili uchun sof funksiyalar.
import { z } from "zod";
import { sniffReceipt, type ReceiptKind } from "@/lib/receipt";

export const LEGAL_DISCLAIMER = "Bu umumiy huquqiy ma'lumot, yuridik maslahat emas. Muhim qaror oldidan yurist bilan maslahatlashing.";

/** Hujjat tahlili: bepul haftasiga 2 ta, Premium 20 ta (savollar limitidan alohida — ko'p token sarflaydi) */
export const DOC_FREE_WEEKLY = 2;
export const DOC_PREMIUM_WEEKLY = 20;
export const MAX_DOC_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 20;
/** Hujjat uchun ko'proq manba moddasi */
export const DOC_MAX_SOURCES = 8;
/** Tahlil qilinmagan fayl shuncha vaqtdan keyin o'chiriladi */
export const UPLOAD_TTL_MS = 60 * 60 * 1000;
/** Bir soatda beriladigan yuklash havolalari */
export const UPLOADS_PER_HOUR = 6;
export const LEGAL_BUCKET = "legal-uploads";

export type Confidence = "high" | "medium" | "low";
export type LegalMode = "legal" | "document";

export const CONFIDENCE_INFO: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "Ishonch: yuqori", cls: "bg-ok-soft text-ok" },
  medium: { label: "Ishonch: o'rta", cls: "bg-amber-soft text-amber" },
  low: { label: "Ishonch: past", cls: "bg-no-soft text-no" },
};

/** Fayl turi baytlardan aniqlanadi (brauzer MIME'iga ishonilmaydi) */
export function sniffFile(bytes: Uint8Array, maxBytes = MAX_DOC_BYTES): { ok: true; kind: ReceiptKind } | { ok: false; message: string } {
  if (!bytes.length) return { ok: false, message: "Fayl bo'sh" };
  if (bytes.length > maxBytes) return { ok: false, message: `Fayl ${Math.round(maxBytes / 1024 / 1024)} MB dan katta` };
  const kind = sniffReceipt(bytes);
  return kind ? { ok: true, kind } : { ok: false, message: "Faqat rasm (JPG, PNG, WEBP) yoki PDF" };
}

/**
 * PDF sahifalari soni (taxminiy): "/Type /Page" obyektlari, ular siqilgan oqimda bo'lsa — "/Type /Pages" dagi eng katta /Count.
 * Aniqlab bo'lmasa 0 (cheklovni Claude'ning o'zi ham qo'llaydi).
 */
export function pdfPageCount(bytes: Uint8Array): number {
  const s = new TextDecoder("latin1").decode(bytes);
  const pages = s.match(/\/Type\s*\/Page(?![a-zA-Z])/g)?.length ?? 0;
  let count = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b[^>]*?\/Count\s+(\d+)|\/Count\s+(\d+)[^>]*?\/Type\s*\/Pages\b/g)) {
    count = Math.max(count, Number(m[1] ?? m[2]));
  }
  return Math.max(pages, count);
}

const normRef = (s: string) =>
  s.toLowerCase().replace(/[‘’ʻʼ`']/g, "'").replace(/\s*-\s*/g, "-").replace(/\s+/g, " ").replace(/[.,;:()]/g, "").trim();

/**
 * Model ko'rsatgan havolalardan faqat manbalarda borlari qoladi (o'ylab topilgan modda raqami ko'rsatilmaydi).
 * Biror havola tashlansa, ishonch bir pog'ona pasayadi.
 */
export function filterCitations(cited: string[], sourceRefs: string[], confidence: Confidence): { refs: string[]; confidence: Confidence; dropped: string[] } {
  const known = new Map(sourceRefs.map((r) => [normRef(r), r]));
  const refs: string[] = [];
  const dropped: string[] = [];
  for (const c of cited) {
    const hit = known.get(normRef(c));
    if (hit) {
      if (!refs.includes(hit)) refs.push(hit);
    } else if (c.trim()) dropped.push(c.trim());
  }
  const down: Record<Confidence, Confidence> = { high: "medium", medium: "low", low: "low" };
  return { refs, confidence: dropped.length ? down[confidence] : confidence, dropped };
}

/** "Yuristga murojaat" tugmasi: ishonch past yoki shaxsiy ish murakkab */
export const showLawyerCta = (m: { confidence: Confidence | null; needs_lawyer: boolean }) => m.needs_lawyer || m.confidence === "low";

/** Hujjat tahlili natijasi saqlanadigan matn (Markdown'siz, "- " ro'yxatlar bilan) */
export function formatDocAnalysis(a: { summary: string; risks: string[]; missing_clauses: string[]; answer: string }): string {
  const list = (items: string[]) => items.map((x) => `- ${x.replace(/\s+/g, " ").trim()}`).join("\n");
  return [
    a.summary.trim() && `Qisqacha: ${a.summary.trim()}`,
    a.risks.length ? `Diqqat qiling:\n\n${list(a.risks)}` : "",
    a.missing_clauses.length ? `Yetishmayotgan yoki noaniq bandlar:\n\n${list(a.missing_clauses)}` : "",
    a.answer.trim(),
  ].filter(Boolean).join("\n\n");
}

export const DOC_EXT = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
export type DocMime = keyof typeof DOC_EXT;

/** Brauzerdan kelgan fayl haqida ma'lumot (yuklash havolasi so'ralganda) */
export const UploadRequestSchema = z.object({
  mime: z.enum(Object.keys(DOC_EXT) as [DocMime, ...DocMime[]], { error: "Faqat rasm (JPG, PNG, WEBP) yoki PDF" }),
  size: z.number().int().positive("Fayl bo'sh").max(MAX_DOC_BYTES, "Fayl 10 MB dan katta"),
  name: z.string().trim().max(200).default(""),
});

export const uploadPathRe = (userId: string) => new RegExp(`^${userId}/[0-9a-f-]{36}\\.(pdf|jpg|png|webp)$`);

/** Fayl nomi bazaga faqat qisqa ko'rinishda (ichidagi ko'rsatma yoki shaxsiy ma'lumot ko'p bo'lmasin) */
export const safeFileName = (name: string) => name.replace(/[^\p{L}\p{N} ._()-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 80) || "hujjat";
