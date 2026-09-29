"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type SaveState = { ok: boolean; message: string } | null;

const PaymentSettings = z.object({
  // Karta raqami: 16 raqam (bo'shliqlar bilan yoki bo'shliqsiz) yoki bo'sh — to'lovni vaqtincha yopish uchun
  card: z.string().trim().regex(/^$|^(\d[ ]?){15}\d$/, "Karta raqami 16 ta raqam bo'lishi kerak"),
  holder: z.string().trim().max(80),
  note: z.string().trim().max(300),
});

export async function savePaymentSettings(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { userId } = await requireRole("admin");
  const parsed = PaymentSettings.safeParse({ card: form.get("card") ?? "", holder: form.get("holder") ?? "", note: form.get("note") ?? "" });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Xato ma'lumot" };
  const card = parsed.data.card.replace(/\s/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
  const { error } = await createSupabaseAdmin()
    .from("app_settings")
    .upsert({ key: "manual_payment", value: { ...parsed.data, card }, updated_at: new Date().toISOString(), updated_by: userId });
  if (error) return { ok: false, message: "Saqlab bo'lmadi" };
  revalidatePath("/admin/sozlamalar");
  revalidatePath("/app/premium");
  return { ok: true, message: card ? "Saqlandi — to'lov formasi ochiq" : "Saqlandi — to'lov formasi yopiq (karta ko'rsatilmagan)" };
}

const PlanInput = z.object({
  code: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  title: z.string().trim().min(1).max(40),
  price_uzs: z.coerce.number().int().min(1000, "Narx kamida 1 000 so'm").max(10_000_000),
  months: z.coerce.number().int().min(1).max(24),
  is_active: z.boolean(),
});

export async function savePlan(_prev: SaveState, form: FormData): Promise<SaveState> {
  await requireRole("admin");
  const parsed = PlanInput.safeParse({
    code: form.get("code"),
    title: form.get("title"),
    price_uzs: String(form.get("price_uzs") ?? "").replace(/\s/g, ""),
    months: form.get("months"),
    is_active: form.get("is_active") === "on",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Xato ma'lumot" };
  // Narx o'zgarsa ham, allaqachon yaratilgan to'lovlar o'z summasini saqlaydi (payments.amount_uzs)
  const { error } = await createSupabaseAdmin().from("plans").update(parsed.data).eq("code", parsed.data.code);
  if (error) return { ok: false, message: "Saqlab bo'lmadi" };
  revalidatePath("/admin/sozlamalar");
  revalidatePath("/app/premium");
  return { ok: true, message: "Saqlandi" };
}
