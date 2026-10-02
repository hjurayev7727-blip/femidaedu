// Escrow: buyurtma holatlari, komissiya, ruxsat etilgan amallar. Sof funksiyalar.
import { z } from "zod";

export const MIN_COMMISSION_PCT = 20;
export const RELEASE_DAYS = 3;

export type OrderStatus = "awaiting_payment" | "review" | "held" | "delivered" | "disputed" | "released" | "paid_out" | "refunded" | "cancelled";

export const ORDER_STATUS: Record<OrderStatus, { label: string; cls: string }> = {
  awaiting_payment: { label: "To'lov kutilmoqda", cls: "bg-amber/15 text-amber" },
  review: { label: "Chek tekshirilmoqda", cls: "bg-amber/15 text-amber" },
  held: { label: "To'langan · bajarilmoqda", cls: "bg-brand-soft text-brand-2" },
  delivered: { label: "Topshirildi · tasdiq kutilmoqda", cls: "bg-brand-soft text-brand-2" },
  disputed: { label: "Nizo · admin ko'rib chiqmoqda", cls: "bg-no-soft text-no" },
  released: { label: "Yakunlandi", cls: "bg-ok-soft text-ok" },
  paid_out: { label: "Yakunlandi · yuristga to'langan", cls: "bg-ok-soft text-ok" },
  refunded: { label: "Pul qaytarildi", cls: "bg-line text-mute" },
  cancelled: { label: "Bekor qilingan", cls: "bg-line text-mute" },
};

/** Komissiya: kamida 20%, yuqoriga yaxlitlanadi (SQL dagi bilan bir xil) */
export function commission(amount: number, pct: number): { pct: number; commission: number; payout: number } {
  const p = Math.min(90, Math.max(MIN_COMMISSION_PCT, Math.round(pct)));
  const c = Math.ceil((amount * p) / 100);
  return { pct: p, commission: c, payout: amount - c };
}

export type OrderView = {
  id: number; role: "client" | "lawyer"; title: string; amount_uzs: number; commission_pct: number; payout_uzs: number;
  status: OrderStatus; provider: "payme" | "manual" | null; receipt_note: string | null; conversation_id: string | null;
  lawyer_id: string; lawyer_name: string; client_name: string; paid_at: string | null; delivered_at: string | null;
  release_after: string | null; released_at: string | null; created_at: string; reviewed: boolean;
  dispute: { reason: string; status: "open" | "resolved"; resolution: "release" | "refund" | null; admin_note: string | null } | null;
};

/** Mijoz/yurist uchun mavjud amallar */
export function orderActions(o: Pick<OrderView, "role" | "status" | "release_after" | "reviewed">, now = Date.now()) {
  const client = o.role === "client";
  const disputeOpen = o.status === "held" || (o.status === "delivered" && (!o.release_after || Date.parse(o.release_after) > now));
  return {
    pay: client && o.status === "awaiting_payment",
    cancel: client && o.status === "awaiting_payment",
    confirm: client && (o.status === "held" || o.status === "delivered"),
    dispute: client && disputeOpen,
    review: client && (o.status === "released" || o.status === "paid_out") && !o.reviewed,
    deliver: !client && o.status === "held",
  };
}

export const DisputeSchema = z.string().trim().min(10, "Sababni batafsilroq yozing (kamida 10 belgi)").max(2000);
export const ReviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Bahoni tanlang").max(5),
  body: z.string().trim().max(1000).default(""),
});
export const CommissionSchema = z.coerce.number().int().min(MIN_COMMISSION_PCT, `Komissiya kamida ${MIN_COMMISSION_PCT}%`).max(90);
