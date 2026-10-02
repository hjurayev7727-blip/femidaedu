import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import type { OrderView } from "@/lib/escrow";
import { lawyerPaymentsEnabled } from "@/lib/escrow-server";
import { fmtSum } from "@/lib/lawyers";
import { receiptSignedUrl } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { recordPayout, resolveDispute, reviewReceipt, saveEscrowSettings } from "./actions";
import { EscrowSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Escrow" };

type Admin = {
  review: (OrderView & { receipt_path: string })[];
  disputed: OrderView[];
  clawback: OrderView[];
  payouts: { lawyer_id: string; lawyer_name: string; card: string | null; holder: string | null; total_uzs: number; order_ids: number[] }[];
  held_total: number;
  commission_total: number;
};

export default async function AdminEscrow() {
  const { userId } = await requireRole("admin");
  const admin = createSupabaseAdmin();
  await admin.rpc("release_due_orders");
  const [{ data }, { data: pct }, enabled] = await Promise.all([
    admin.rpc("escrow_admin", { p_admin: userId }),
    admin.rpc("lawyer_commission_pct"),
    lawyerPaymentsEnabled(),
  ]);
  const q = (data ?? { review: [], disputed: [], clawback: [], payouts: [], held_total: 0, commission_total: 0 }) as Admin;
  const urls = await Promise.all(q.review.map((o) => receiptSignedUrl(o.receipt_path)));
  const orderLink = (o: OrderView) => <Link href={`/app/buyurtmalar/${o.id}`} className="font-bold hover:underline">#{o.id} {o.title}</Link>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Escrow — yurist xizmatlari</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card"><p className="text-xs font-bold uppercase text-mute">Platformada saqlanmoqda</p><p className="mt-1 text-2xl font-extrabold">{fmtSum(Number(q.held_total))}</p></div>
        <div className="card"><p className="text-xs font-bold uppercase text-mute">Komissiya (yakunlangan)</p><p className="mt-1 text-2xl font-extrabold">{fmtSum(Number(q.commission_total))}</p></div>
      </div>
      <EscrowSettingsForm pct={Number(pct ?? 20)} enabled={enabled} action={saveEscrowSettings} />

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Cheklar ({q.review.length})</h2>
        {q.review.length === 0 && <p className="px-5 py-4 text-mute">Navbat bo&apos;sh.</p>}
        <ul className="divide-y divide-line">
          {q.review.map((o, i) => (
            <li key={o.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap justify-between gap-2">{orderLink(o)}<b>{fmtSum(o.amount_uzs)}</b></div>
              <p className="text-sm text-mute">{o.client_name} → {o.lawyer_name} · {fmtUz(o.created_at, { time: true })}</p>
              {urls[i] && <a href={urls[i]!} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-2 hover:underline">📎 Chekni ochish</a>}
              <form action={reviewReceipt} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="note" maxLength={300} placeholder="Rad etish sababi" className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-1.5 text-sm" />
                <button name="decision" value="approve" className="btn-primary !py-1.5 !text-sm">Tasdiqlash</button>
                <button name="decision" value="reject" className="btn-ghost !py-1.5 !text-sm">Rad etish</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Nizolar ({q.disputed.length})</h2>
        {q.disputed.length === 0 && <p className="px-5 py-4 text-mute">Nizo yo&apos;q.</p>}
        <ul className="divide-y divide-line">
          {q.disputed.map((o) => (
            <li key={o.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap justify-between gap-2">{orderLink(o)}<b>{fmtSum(o.amount_uzs)}</b></div>
              <p className="text-sm text-mute">{o.client_name} → {o.lawyer_name} · to&apos;lov: {o.provider === "payme" ? "Payme" : "karta"}</p>
              <p className="whitespace-pre-wrap text-sm">{o.dispute?.reason}</p>
              <form action={resolveDispute} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="note" maxLength={1000} placeholder="Qaror izohi (ikkala tomonga ko'rinadi)" className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-1.5 text-sm" />
                <button name="resolution" value="release" className="btn-ghost !py-1.5 !text-sm">Yuristga o&apos;tkazish</button>
                <button name="resolution" value="refund" className="btn-ghost !py-1.5 !text-sm text-no">Mijozga qaytarish</button>
              </form>
              <p className="text-xs text-mute">Qaytarish: Payme — kassa kabinetidan bekor qiling; karta — mijozga qo&apos;lda o&apos;tkazing.</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Yuristlarga to&apos;lanadigan ({q.payouts.length})</h2>
        {q.payouts.length === 0 && <p className="px-5 py-4 text-mute">To&apos;lanadigan summa yo&apos;q.</p>}
        <ul className="divide-y divide-line">
          {q.payouts.map((p) => (
            <li key={p.lawyer_id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap justify-between gap-2">
                <Link href={`/app/yuristlar/${p.lawyer_id}`} className="font-bold hover:underline">{p.lawyer_name}</Link>
                <b>{fmtSum(Number(p.total_uzs))}</b>
              </div>
              <p className="text-sm">{p.card ? <>Karta: <b className="font-mono">{p.card.replace(/(\d{4})(?=\d)/g, "$1 ")}</b>{p.holder && ` (${p.holder})`}</> : <span className="text-no">Karta kiritilmagan</span>} · buyurtmalar: {p.order_ids.map((x) => `#${x}`).join(", ")}</p>
              <form action={recordPayout} className="flex flex-wrap gap-2">
                <input type="hidden" name="lawyer" value={p.lawyer_id} />
                <input type="hidden" name="orders" value={p.order_ids.join(",")} />
                <input name="reference" required minLength={3} maxLength={200} placeholder="O'tkazma raqami / izoh" className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-1.5 text-sm" />
                <button className="btn-primary !py-1.5 !text-sm">To&apos;landi deb belgilash</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {q.clawback.length > 0 && (
        <section className="card !p-0">
          <h2 className="border-b border-line px-5 py-4 font-extrabold text-no">Payme qaytargan, lekin yuristga o&apos;tgan ({q.clawback.length})</h2>
          <ul className="divide-y divide-line">
            {q.clawback.map((o) => (
              <li key={o.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">{orderLink(o)}<span className="text-sm">{o.lawyer_name} · {fmtSum(o.payout_uzs)}</span></li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-mute">Bu buyurtmalar yuristga to&apos;lanmaydi; allaqachon to&apos;langan bo&apos;lsa — yurist bilan qo&apos;lda hal qiling.</p>
        </section>
      )}
    </div>
  );
}
