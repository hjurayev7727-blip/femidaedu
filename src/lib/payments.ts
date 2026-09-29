import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { checkReceipt } from "@/lib/receipt";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const RECEIPT_BUCKET = "receipts";

export type Plan = { code: string; title: string; months: number; price_uzs: number; sort: number; is_active?: boolean };
export type ManualPaymentSettings = { card: string; holder: string; note: string };

export function formatUzs(n: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(n).replace(/ /g, " ")} so'm`;
}

export type SubmitPaymentResult = { ok: true } | { ok: false; message: string };

/** Chekni tekshiradi, yopiq bucket'ga yuklaydi va to'lovni "kutilmoqda" holatida yaratadi. */
export async function submitManualPayment(userId: string, planCode: string, file: unknown): Promise<SubmitPaymentResult> {
  const receipt = await checkReceipt(file);
  if (!receipt.ok) return { ok: false, message: receipt.message };

  const admin = createSupabaseAdmin();
  const path = `${userId}/${randomUUID()}.${receipt.kind.ext}`;
  const { error: upErr } = await admin.storage
    .from(RECEIPT_BUCKET)
    .upload(path, receipt.bytes, { contentType: receipt.kind.mime, upsert: false });
  if (upErr) {
    console.error("receipt upload", upErr.message);
    return { ok: false, message: "Chekni yuklab bo'lmadi. Qayta urinib ko'ring." };
  }

  // Bir xil chek fayli boshqa akkauntdan qayta yuborilmasin
  const sha256 = createHash("sha256").update(receipt.bytes).digest("hex");
  const { data, error } = await admin.rpc("create_manual_payment", { p_user: userId, p_plan: planCode, p_receipt: path, p_sha256: sha256 });
  const r = data as { ok: boolean; reason?: string } | null;
  if (error || !r?.ok) {
    await admin.storage.from(RECEIPT_BUCKET).remove([path]); // yetim fayl qolmasin
    if (r?.reason === "pending") return { ok: false, message: "Oldingi to'lovingiz hali ko'rib chiqilmoqda." };
    if (r?.reason === "plan") return { ok: false, message: "Tarif topilmadi." };
    if (r?.reason === "duplicate_receipt") return { ok: false, message: "Bu chek avval yuborilgan. Yangi to'lov chekini yuklang." };
    console.error("create_manual_payment", error?.message);
    return { ok: false, message: "Serverda xatolik. Qayta urinib ko'ring." };
  }
  return { ok: true };
}

/** Admin uchun chekni ko'rish havolasi (10 daqiqa amal qiladi). */
export async function receiptSignedUrl(path: string): Promise<string | null> {
  const { data } = await createSupabaseAdmin().storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
