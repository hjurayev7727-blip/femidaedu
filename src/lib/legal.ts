// "Savol bering" va hujjat tahlili: limitlar, fayl tekshiruvi, manba havolalarini tekshirish. Sof funksiyalar.
import { z } from "zod";
import { sniffReceipt, type ReceiptKind } from "@/lib/receipt";

/** Hujjat tahlili — alohida haftalik limit (savollar AI yordamchi limitidan) */
export const DOC_FREE_WEEKLY = 2;
export const DOC_PREMIUM_WEEKLY = 20;
export const DOC_MAX_BYTES = 10 * 1024 * 1024;
export const DOC_MAX_PAGES = 20;
/** Hujjat tahlilida manba moddalar ko'proq (shartnoma bir nechta sohaga tegadi) */
export const DOC_MAX_SOURCES = 8;

export const LEGAL_DISCLAIMER =
  "Bu umumiy huquqiy ma'lumot, yuridik maslahat emas. Aniq ishingiz bo'yicha qaror qabul qilishdan oldin yurist bilan maslahatlashing.";

export type Confidence = "high" | "medium" | "low";

export const CONFIDENCE_INFO: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "Manbalar aniq", cls: "bg-ok-soft text-ok" },
  medium: { label: "Qisman manbali", cls: "bg-amber/15 text-amber" },
  low: { label: "Manba yetarli emas", cls: "bg-no-soft text-no" },
};

export const LegalQuestionSchema = z.string().trim().min(5, "Savolingizni batafsilroq yozing").max(3000, "Savol 3000 belgidan oshmasin");
export const DocQuestionSchema = z.string().trim().max(1000, "Savol 1000 belgidan oshmasin").default("");

/** Faylni foydalanuvchi papkasida saqlash yo'li: <user>/<uuid>.<ext>. Boshqa yo'l qabul qilinmaydi. */
export const DOC_PATH_RE = /^([0-9a-f-]{36})\/([0-9a-f-]{36})\.(pdf|jpg|png|webp)$/;
export function ownsDocPath(path: string, userId: string): boolean {
  const m = DOC_PATH_RE.exec(path);
  return Boolean(m && m[1] === userId);
}

export const DOC_EXT: Record<string, "pdf" | "jpg" | "png" | "webp"> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
};

export type DocCheck = { ok: true; kind: ReceiptKind; pages: number } | { ok: false; message: string };

/** PDF sahifalar soni (taxminiy: /Type /Page obyektlari). Claude ham o'z chegarasini tekshiradi. */
export function pdfPageCount(bytes: Uint8Array): number {
  const text = new TextDecoder("latin1").decode(bytes);
  return (text.match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
}

/** Yuklangan fayl: brauzer aytgan turga emas, birinchi baytlarga ishoniladi; hajm va sahifa chegarasi */
export function checkDoc(bytes: Uint8Array): DocCheck {
  if (bytes.length === 0) return { ok: false, message: "Fayl bo'sh." };
  if (bytes.length > DOC_MAX_BYTES) return { ok: false, message: "Fayl 10 MB dan katta." };
  const kind = sniffReceipt(bytes);
  if (!kind) return { ok: false, message: "Faqat PDF yoki rasm (JPG, PNG, WEBP)." };
  const pages = kind.ext === "pdf" ? pdfPageCount(bytes) : 1;
  if (kind.ext === "pdf" && pages > DOC_MAX_PAGES) return { ok: false, message: `PDF ${DOC_MAX_PAGES} sahifadan oshmasin (${pages} sahifa).` };
  return { ok: true, kind, pages: Math.max(pages, 1) };
}

const norm = (s: string) => s.toLowerCase().replace(/[‘’ʻʼ`']/g, "'").replace(/\s+/g, " ").trim();

/**
 * AI ko'rsatgan havolalardan faqat haqiqatan berilgan manbalardagilarini qoldiradi.
 * O'ylab topilgan havola bo'lsa — ishonch darajasi pasaytiriladi.
 */
export function filterCitations(cited: string[], sourceRefs: string[], confidence: Confidence): { refs: string[]; confidence: Confidence; dropped: number } {
  const known = new Map(sourceRefs.map((r) => [norm(r), r]));
  const refs: string[] = [];
  let dropped = 0;
  for (const c of cited) {
    const hit = known.get(norm(c));
    if (hit) {
      if (!refs.includes(hit)) refs.push(hit);
    } else dropped++;
  }
  let conf = confidence;
  if (dropped > 0 && conf === "high") conf = "medium";
  if (refs.length === 0 && sourceRefs.length > 0 && conf !== "low") conf = "medium";
  if (sourceRefs.length === 0) conf = "low";
  return { refs, confidence: conf, dropped };
}

/** "Yuristga murojaat" tugmasi: ishonch past yoki AI murakkab shaxsiy ish deb belgilagan bo'lsa */
export function showLawyerCta(m: { confidence: Confidence | null; needs_lawyer: boolean }): boolean {
  return m.needs_lawyer || m.confidence === "low";
}

export type DocMeta = { type: "pdf" | "image"; pages: number; name: string };

/** Fayl nomi: faqat ko'rsatish uchun, xavfsiz qisqa ko'rinishda */
export function safeDocName(name: unknown): string {
  const s = typeof name === "string" ? name : "";
  const clean = s.replace(/[\u0000-\u001f<>"'`\\/]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "hujjat";
}
