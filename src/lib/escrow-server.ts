import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AiResult } from "@/lib/ai-server";
import type { OrderView } from "@/lib/escrow";
import { checkReceipt } from "@/lib/receipt";
import { RECEIPT_BUCKET } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const REASON: Record<string, string> = {
  not_found: "Buyurtma topilmadi.",
  offer: "Taklif endi amal qilmaydi.",
  lawyer: "Yurist hozir faol emas.",
  status: "Bu amalni hozir bajarib bo'lmaydi.",
  path: "Fayl topilmadi.",
  duplicate_receipt: "Bu chek avval yuborilgan. Yangi to'lov chekini yuklang.",
  rating: "Bahoni tanlang.",
  already: "Siz allaqachon baho qoldirgansiz.",
  forbidden: "Ruxsat yo'q.",
  orders: "Tanlangan buyurtmalar to'lovga tayyor emas.",
};
type R = { ok: boolean; reason?: string } & Record<string, unknown>;
export const failText = (r: R | null) => REASON[r?.reason ?? ""] ?? "Xatolik yuz berdi.";

/** Yurist xizmatlari uchun to'lov yoqilganmi (huquqiy xulosadan keyin admin yoqadi) */
export async function lawyerPaymentsEnabled(): Promise<boolean> {
  const { data } = await createSupabaseAdmin().from("app_settings").select("value").eq("key", "lawyer_payments_enabled").maybeSingle<{ value: unknown }>();
  return data?.value === true;
}

export async function createServiceOrder(userId: string, offerId: number): Promise<AiResult<number>> {
  const { data } = await createSupabaseAdmin().rpc("create_service_order", { p_user: userId, p_offer: offerId });
  const r = data as R | null;
  return r?.ok ? { ok: true, value: r.id as number } : { ok: false, message: failText(r) };
}

export async function orderDetail(userId: string, id: number) {
  const admin = createSupabaseAdmin();
  await admin.rpc("release_due_orders"); // muddati o'tganlar shu zahoti yangilanadi
  const { data } = await admin.rpc("order_detail", { p_user: userId, p_order: id });
  return (data ?? null) as OrderView | null;
}

export async function myOrders(userId: string) {
  const admin = createSupabaseAdmin();
  await admin.rpc("release_due_orders");
  const { data } = await admin.rpc("my_orders", { p_user: userId });
  return (data ?? []) as OrderView[];
}

/** Karta orqali to'lov cheki — Premium'dagi kabi tekshiriladi va yopiq bucket'ga yuklanadi */
export async function submitServiceReceipt(userId: string, orderId: number, file: unknown): Promise<AiResult<true>> {
  const receipt = await checkReceipt(file);
  if (!receipt.ok) return { ok: false, message: receipt.message };
  const admin = createSupabaseAdmin();
  const path = `${userId}/${randomUUID()}.${receipt.kind.ext}`;
  const { error } = await admin.storage.from(RECEIPT_BUCKET).upload(path, receipt.bytes, { contentType: receipt.kind.mime, upsert: false });
  if (error) return { ok: false, message: "Chekni yuklab bo'lmadi. Qayta urinib ko'ring." };
  const sha256 = createHash("sha256").update(receipt.bytes).digest("hex");
  const { data } = await admin.rpc("submit_service_receipt", { p_user: userId, p_order: orderId, p_path: path, p_sha256: sha256 });
  const r = data as R | null;
  if (!r?.ok) {
    await admin.storage.from(RECEIPT_BUCKET).remove([path]);
    return { ok: false, message: failText(r) };
  }
  return { ok: true, value: true };
}

export async function simpleRpc(fn: string, args: Record<string, unknown>): Promise<AiResult<true>> {
  const { data, error } = await createSupabaseAdmin().rpc(fn, args);
  if (error) return { ok: false, message: "Xatolik yuz berdi." };
  if (data === true) return { ok: true, value: true };
  const r = data as R | null;
  return r?.ok ? { ok: true, value: true } : { ok: false, message: failText(r ?? { ok: false, reason: "status" }) };
}
