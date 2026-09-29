import type { Metadata } from "next";
import { AI_DAILY_LIMIT } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { FREE_MONTHLY_MOCKS } from "@/lib/mock-server";
import { formatUzs, type ManualPaymentSettings, type Plan } from "@/lib/payments";
import { paymeEnv } from "@/lib/payme";
import { FREE_DAILY_LIMIT } from "@/lib/practice";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { payWithPayme } from "./actions";
import { PayForm } from "./pay-form";

export const metadata: Metadata = { title: "Premium" };

type PaymentRow = { id: number; amount_uzs: number; months: number; status: "pending" | "paid" | "rejected" | "refunded"; created_at: string; reject_reason: string | null; provider: string };

const STATUS: Record<PaymentRow["status"], { text: string; cls: string }> = {
  pending: { text: "Tekshirilmoqda", cls: "bg-amber-soft text-amber" },
  paid: { text: "Tasdiqlandi", cls: "bg-ok-soft text-ok" },
  rejected: { text: "Rad etildi", cls: "bg-no-soft text-no" },
  refunded: { text: "Qaytarildi", cls: "bg-bg text-mute" },
};

const FEATURES: [string, string, string][] = [
  ["Mavzu bo'yicha mashq", `kuniga ${FREE_DAILY_LIMIT} savol`, "cheksiz"],
  ["Sinov imtihoni (45 topshiriq)", `oyiga ${FREE_MONTHLY_MOCKS} ta`, "cheksiz"],
  ["Izoh + qonun moddasi", "✓", "✓"],
  ["Xatolar ustida ishlash, kunlik test", "✓", "✓"],
  ["AI ustoz: savolni tushuntirish, yozma javobni qayta tekshirish", "—", `kuniga ${AI_DAILY_LIMIT} ta`],
  ["Musobaqalar", "—", "tez orada"],
];

const fmtDate = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "long", year: "numeric" });

export default async function PremiumPage({ searchParams }: PageProps<"/app/premium">) {
  const { supabase, userId } = await requireUser();
  const paymeParam = (await searchParams).payme;
  const paymeCode = typeof paymeParam === "string" ? paymeParam : null;
  const [{ data: until }, { data: plans }, { data: settings }, { data: payments }, { data: premium }] = await Promise.all([
    supabase.rpc("my_premium_until"),
    supabase.from("plans").select("code, title, months, price_uzs, sort").order("sort").returns<Plan[]>(),
    supabase.from("app_settings").select("value").eq("key", "manual_payment").maybeSingle<{ value: ManualPaymentSettings }>(),
    supabase
      .from("payments")
      .select("id, amount_uzs, months, status, created_at, reject_reason, provider")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<PaymentRow[]>(),
    supabase.rpc("is_premium"),
  ]);

  // Payme'dan qaytganda: shu foydalanuvchining buyurtma holati (payme_orders mijozga yopiq — admin klient, user_id bilan)
  const paymeOrder =
    paymeCode && /^A[A-Z0-9]{9}$/.test(paymeCode)
      ? (await createSupabaseAdmin().from("payme_orders").select("status").eq("code", paymeCode).eq("user_id", userId).maybeSingle<{ status: string }>()).data
      : null;
  const payme = paymeEnv() !== null;

  const pay = settings?.value;
  const pending = (payments ?? []).some((p) => p.status === "pending");
  const canPayManually = Boolean(pay?.card?.trim()) && (plans ?? []).length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="bg-hero rounded-[22px] p-6 text-white">
        <p className="text-sm font-bold uppercase tracking-wider text-cyan-100">A+ Premium</p>
        {premium ? (
          <>
            <p className="mt-2 text-2xl font-extrabold">Premium faol ✓</p>
            <p className="mt-1 text-slate-300">
              {until ? `${fmtDate(until as string)} gacha` : "Guruh (kurs) orqali"} · cheksiz mashq va sinovlar
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-2xl font-extrabold">Cheksiz tayyorgarlik — imtihongacha</p>
            <p className="mt-1 text-slate-300">Kunlik limitlarsiz mashq va cheksiz sinov imtihonlari.</p>
          </>
        )}
      </div>

      <div className="card overflow-x-auto p-0!">
        <table className="w-full text-left text-[15px]">
          <thead className="text-xs uppercase tracking-wider text-mute">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-bold">Imkoniyat</th>
              <th className="px-3 py-3 font-bold">Bepul</th>
              <th className="px-3 py-3 font-bold text-cyan-2">Premium</th>
            </tr>
          </thead>
          <tbody>
            {FEATURES.map(([f, free, pro]) => (
              <tr key={f} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-semibold">{f}</td>
                <td className="px-3 py-3 text-mute">{free}</td>
                <td className="px-3 py-3 font-bold">{pro}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {paymeCode === "xato" && (
        <p className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">Payme to&apos;lovini boshlab bo&apos;lmadi. Qayta urinib ko&apos;ring.</p>
      )}
      {paymeOrder?.status === "paid" && (
        <p className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">✓ To&apos;lov qabul qilindi — Premium faollashdi.</p>
      )}
      {paymeOrder && paymeOrder.status !== "paid" && (
        <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm">
          To&apos;lov hali tasdiqlanmadi. Agar to&apos;lagan bo&apos;lsangiz, bir necha daqiqadan keyin sahifani yangilang.
        </p>
      )}

      {payme && (plans ?? []).length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-lg font-extrabold">{premium ? "Muddatni uzaytirish" : "Premium olish"} — Payme</h2>
          <p className="text-sm text-mute">Istalgan bank kartasi (Uzcard, Humo) bilan. Premium to&apos;lovdan so&apos;ng darhol yoqiladi.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {plans!.map((p) => (
              <form key={p.code} action={payWithPayme}>
                <input type="hidden" name="plan" value={p.code} />
                <button type="submit" className="btn-primary w-full">
                  {p.title} — {formatUzs(p.price_uzs)}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}

      {(canPayManually || !payme) && (
      <section className="card space-y-4">
        <h2 className="text-lg font-extrabold">
          {payme ? "Karta orqali o'tkazma (chek bilan)" : premium ? "Muddatni uzaytirish" : "Premium olish"}
        </h2>
        {!canPayManually ? (
          <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm">To&apos;lov hozircha qabul qilinmayapti — tez orada ochiladi.</p>
        ) : pending ? (
          <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold">
            Chekingiz tekshirilmoqda. Tasdiqlangach Premium avtomatik yoqiladi (odatda 24 soat ichida).
          </p>
        ) : (
          <>
            <ol className="space-y-2 text-[15px]">
              <li>
                <b>1.</b> Tanlangan tarif summasini kartaga o&apos;tkazing:
                <span className="mt-1.5 block rounded-xl bg-bg px-4 py-3">
                  <span className="block font-mono text-lg font-extrabold tracking-wider">{pay!.card}</span>
                  {pay!.holder && <span className="text-sm text-mute">{pay!.holder}</span>}
                </span>
              </li>
              <li><b>2.</b> To&apos;lov chekini (skrinshot) shu yerga yuklang.</li>
              {pay!.note && <li className="text-sm text-mute">{pay!.note}</li>}
            </ol>
            <PayForm plans={(plans ?? []).map((p) => ({ code: p.code, title: p.title, months: p.months, price: formatUzs(p.price_uzs) }))} />
          </>
        )}
      </section>
      )}

      {(payments ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold">To&apos;lovlarim</h2>
          <ul className="card divide-y divide-line p-0!">
            {payments!.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <span className="text-sm">
                  {fmtDate(p.created_at)} · {p.months} oy · <b>{formatUzs(p.amount_uzs)}</b>
                  {p.reject_reason && <span className="block text-xs text-no">Sabab: {p.reject_reason}</span>}
                </span>
                <span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${STATUS[p.status].cls}`}>{STATUS[p.status].text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
