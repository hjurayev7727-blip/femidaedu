import "server-only";
import { z } from "zod";

/**
 * Payme — DOYSE kassasi orqali (YURISTIM TEAM MCHJ). Payme Merchant API so'rovlari doyse.uz ga keladi,
 * DOYSE kalitni tekshiradi va Femida Edu buyurtmalarini (kod "F…") bu yerga PAYME_FORWARD_SECRET bilan uzatadi.
 * Shuning uchun Femida Edu da Payme kaliti yo'q — faqat kassa ID (ochiq) va uzatish kaliti.
 */
export function paymeEnv() {
  const parsed = z
    .object({
      PAYME_MERCHANT_ID: z.string().regex(/^[a-f0-9]{24}$/),
      PAYME_FORWARD_SECRET: z.string().regex(/^[A-Za-z0-9_-]{32,256}$/),
      PAYME_CHECKOUT_URL: z.url().default("https://checkout.paycom.uz"),
    })
    .safeParse({
      PAYME_MERCHANT_ID: process.env.PAYME_MERCHANT_ID,
      PAYME_FORWARD_SECRET: process.env.PAYME_FORWARD_SECRET,
      PAYME_CHECKOUT_URL: process.env.PAYME_CHECKOUT_URL || undefined,
    });
  return parsed.success ? parsed.data : null;
}

/** Payme to'lov sahifasi havolasi (GET, base64 parametrlar). Summa tiyinda. */
export function paymeCheckoutUrl(cfg: { PAYME_MERCHANT_ID: string; PAYME_CHECKOUT_URL: string }, order: { code: string; amountUzs: number }, returnUrl: string) {
  const params = [`m=${cfg.PAYME_MERCHANT_ID}`, `ac.order_id=${order.code}`, `a=${order.amountUzs * 100}`, `c=${returnUrl}`, "l=uz"].join(";");
  return `${cfg.PAYME_CHECKOUT_URL.replace(/\/$/, "")}/${Buffer.from(params).toString("base64")}`;
}

const MESSAGES: Record<number, { uz: string; ru: string; en: string }> = {
  [-31001]: { uz: "Summa noto'g'ri", ru: "Неверная сумма", en: "Wrong amount" },
  [-31003]: { uz: "Tranzaksiya topilmadi", ru: "Транзакция не найдена", en: "Transaction not found" },
  [-31008]: { uz: "Amalni bajarib bo'lmaydi", ru: "Невозможно выполнить операцию", en: "Unable to perform operation" },
  [-31050]: { uz: "Buyurtma topilmadi", ru: "Заказ не найден", en: "Order not found" },
  [-31051]: { uz: "Buyurtma to'lab bo'lingan yoki bekor qilingan", ru: "Заказ уже оплачен или отменён", en: "Order is not payable" },
  [-32300]: { uz: "So'rov noto'g'ri", ru: "Неверный запрос", en: "Invalid request" },
  [-32400]: { uz: "Tizim xatosi", ru: "Системная ошибка", en: "System error" },
  [-32504]: { uz: "Ruxsat yo'q", ru: "Недостаточно привилегий", en: "Insufficient privilege" },
  [-32601]: { uz: "Metod topilmadi", ru: "Метод не найден", en: "Method not found" },
  [-32700]: { uz: "JSON xato", ru: "Ошибка разбора JSON", en: "Parse error" },
};

export type PaymeRpcResult = { result?: unknown; error?: { code: number; message?: string; data?: string } };

/** Bazadagi payme_rpc natijasini Payme JSON-RPC javobiga aylantiradi. */
export function paymeResponse(id: unknown, r: PaymeRpcResult) {
  if (r.error) {
    const { code, data } = r.error;
    const message = MESSAGES[code] ?? { uz: r.error.message ?? "Xato", ru: r.error.message ?? "Ошибка", en: r.error.message ?? "Error" };
    return { jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data ? { data } : {}) } };
  }
  return { jsonrpc: "2.0", id: id ?? null, result: r.result };
}

export const PAYME_METHODS = ["CheckPerformTransaction", "CreateTransaction", "PerformTransaction", "CancelTransaction", "CheckTransaction", "GetStatement"] as const;
