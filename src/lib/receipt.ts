// To'lov chekini tekshirish — brauzer yuborgan MIME turiga ishonilmaydi, faylning birinchi baytlari tekshiriladi.

export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export type ReceiptKind = { mime: "image/jpeg" | "image/png" | "image/webp" | "application/pdf"; ext: "jpg" | "png" | "webp" | "pdf" };

export function sniffReceipt(bytes: Uint8Array): ReceiptKind | null {
  const at = (i: number, ...sig: number[]) => sig.every((b, k) => bytes[i + k] === b);
  if (at(0, 0xff, 0xd8, 0xff)) return { mime: "image/jpeg", ext: "jpg" };
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return { mime: "image/png", ext: "png" };
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return { mime: "image/webp", ext: "webp" };
  if (at(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return { mime: "application/pdf", ext: "pdf" };
  return null;
}

export type ReceiptCheck = { ok: true; kind: ReceiptKind; bytes: Uint8Array } | { ok: false; message: string };

export async function checkReceipt(file: unknown): Promise<ReceiptCheck> {
  if (!(file instanceof Blob) || file.size === 0) return { ok: false, message: "Chek faylini tanlang" };
  if (file.size > RECEIPT_MAX_BYTES) return { ok: false, message: "Fayl 5 MB dan katta" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffReceipt(bytes);
  return kind ? { ok: true, kind, bytes } : { ok: false, message: "Faqat rasm (JPG, PNG, WEBP) yoki PDF" };
}
