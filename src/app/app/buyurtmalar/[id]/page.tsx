import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DisputeForm, ReceiptForm, ReviewForm } from "@/components/escrow/order-forms";
import { OtherPayMethods, RecommendedBadge } from "@/components/pay-options";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { ORDER_STATUS, orderActions, RELEASE_DAYS } from "@/lib/escrow";
import { orderDetail } from "@/lib/escrow-server";
import { fmtSum } from "@/lib/lawyers";
import type { ManualPaymentSettings } from "@/lib/payments";
import { paymeEnv } from "@/lib/payme";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { cancelOrder, confirmOrder, leaveReview, markDelivered, openDispute, payWithPayme, uploadReceipt } from "../actions";

export const metadata: Metadata = { title: "Buyurtma" };

export default async function OrderPage({ params, searchParams }: PageProps<"/app/buyurtmalar/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const oid = z.coerce.number().int().positive().safeParse(id);
  if (!oid.success) notFound();
  const { userId } = await requireUser();
  const o = await orderDetail(userId, oid.data);
  if (!o) notFound();
  const admin = createSupabaseAdmin();
  const [{ data: pay }, { data: contacts }] = await Promise.all([
    admin.from("app_settings").select("value").eq("key", "manual_payment").maybeSingle<{ value: ManualPaymentSettings }>(),
    o.role === "client" ? admin.rpc("lawyer_contacts", { p_user: userId, p_lawyer: o.lawyer_id }) : Promise.resolve({ data: null }),
  ]);
  // eslint-disable-next-line react-hooks/purity -- server komponent: amallar joriy vaqtga bog'liq
  const can = orderActions(o, Date.now());
  const st = ORDER_STATUS[o.status];
  const c = contacts as { phone: string | null; telegram: string | null } | null;
  const hidden = (n: number) => <input type="hidden" name="order" value={n} />;
  // Payme — asosiy usul; karta → chek — ikkinchi darajali (Payme yoqilgan bo'lsa yig'ilgan)
  const payme = paymeEnv() !== null;
  const cardPay = pay?.value?.card ? (
    <div className="space-y-2 rounded-xl bg-bg p-3">
      <p className="text-sm">Karta orqali: <b>{pay.value.card}</b>{pay.value.holder && <> ({pay.value.holder})</>} — {fmtSum(o.amount_uzs)}, keyin chekni yuklang.</p>
      {o.receipt_note && <p className="text-sm font-semibold text-no">Oldingi chek: {o.receipt_note}</p>}
      <ReceiptForm order={o.id} action={uploadReceipt} />
    </div>
  ) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/buyurtmalar" className="hover:underline">Buyurtmalar</Link> › #{o.id}</nav>
      {typeof sp.xato === "string" && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{sp.xato.slice(0, 200)}</p>}
      {sp.payme === "1" && o.status === "awaiting_payment" && <p role="status" className="rounded-xl bg-amber/15 px-4 py-3 text-sm font-semibold text-amber">Payme to&apos;lovi tekshirilmoqda — bir necha soniyadan keyin sahifani yangilang.</p>}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-extrabold">{o.title}</h1>
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-mute">{o.role === "client" ? "Yurist" : "Mijoz"}</dt>
          <dd className="font-bold">{o.role === "client" ? <Link href={`/app/yuristlar/${o.lawyer_id}`} className="hover:underline">{o.lawyer_name}</Link> : o.client_name}</dd>
          <dt className="text-mute">Summa</dt><dd className="font-bold">{fmtSum(o.amount_uzs)}</dd>
          {o.role === "lawyer" && <><dt className="text-mute">Sizga (komissiya {o.commission_pct}% chegirilgan)</dt><dd className="font-bold">{fmtSum(o.payout_uzs)}</dd></>}
          {o.paid_at && <><dt className="text-mute">To&apos;langan</dt><dd>{fmtUz(o.paid_at, { time: true })}</dd></>}
          {o.release_after && o.status === "delivered" && <><dt className="text-mute">Avtomatik tasdiq</dt><dd>{fmtUz(o.release_after, { time: true })}</dd></>}
        </dl>
        {o.conversation_id && <Link href={`/app/suhbatlar/${o.conversation_id}`} className="text-sm font-bold text-brand-2 hover:underline">💬 Suhbatga o&apos;tish</Link>}
      </section>

      {c && (c.phone || c.telegram) && (
        <section className="card">
          <h2 className="font-extrabold">Yurist kontaktlari</h2>
          <p className="mt-1 text-sm">{c.phone && <>📞 <a href={`tel:${c.phone}`} className="font-bold">{c.phone}</a></>} {c.telegram && <>· ✈️ <a href={`https://t.me/${c.telegram}`} target="_blank" rel="noreferrer" className="font-bold">@{c.telegram}</a></>}</p>
        </section>
      )}

      {can.pay && (
        <section className="card space-y-4">
          <h2 className="font-extrabold">To&apos;lov</h2>
          <p className="text-sm text-mute">Pul platformada saqlanadi. Xizmatni tasdiqlaganingizdan so&apos;ng (yoki yurist topshirgach {RELEASE_DAYS} kun ichida e&apos;tiroz bo&apos;lmasa) yuristga o&apos;tadi. Muammo bo&apos;lsa — e&apos;tiroz bildirasiz va admin hal qiladi.</p>
          {payme && (
            <form action={payWithPayme} className="space-y-1.5">
              {hidden(o.id)}
              <div className="flex items-center gap-2 text-sm font-bold">Payme — karta orqali onlayn <RecommendedBadge /></div>
              <button className="btn-primary w-full">Payme orqali to&apos;lash · {fmtSum(o.amount_uzs)}</button>
            </form>
          )}
          {cardPay && (payme ? <OtherPayMethods summary="Boshqa usul: karta orqali o'tkazma (chek bilan)" open={Boolean(o.receipt_note)}>{cardPay}</OtherPayMethods> : cardPay)}
          {!payme && !pay?.value?.card && <p className="text-sm font-semibold text-amber">To&apos;lov usullari hali sozlanmagan.</p>}
        </section>
      )}

      {o.dispute && (
        <section className="card">
          <h2 className="font-extrabold">E&apos;tiroz</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm">{o.dispute.reason}</p>
          {o.dispute.status === "resolved" && (
            <p className="mt-2 text-sm font-semibold">Admin qarori: {o.dispute.resolution === "refund" ? "pul mijozga qaytariladi" : "to'lov yuristga o'tkaziladi"}{o.dispute.admin_note && ` — ${o.dispute.admin_note}`}</p>
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {can.deliver && <form action={markDelivered}>{hidden(o.id)}<button className="btn-primary">✅ Xizmat bajarildi</button></form>}
        {can.confirm && <form action={confirmOrder}>{hidden(o.id)}<button className="btn-primary">✅ Xizmatni qabul qilaman</button></form>}
        {can.cancel && <form action={cancelOrder}>{hidden(o.id)}<button className="btn-ghost">Bekor qilish</button></form>}
        {can.dispute && <DisputeForm order={o.id} action={openDispute} />}
      </div>

      {can.review && (
        <section className="card space-y-2">
          <h2 className="font-extrabold">Yuristni baholang</h2>
          <ReviewForm order={o.id} action={leaveReview} />
        </section>
      )}
    </div>
  );
}
