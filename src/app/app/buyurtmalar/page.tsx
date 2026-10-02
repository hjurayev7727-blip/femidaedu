import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { ORDER_STATUS } from "@/lib/escrow";
import { myOrders } from "@/lib/escrow-server";
import { fmtSum } from "@/lib/lawyers";

export const metadata: Metadata = { title: "Buyurtmalar" };

export default async function Orders() {
  const { userId } = await requireUser();
  const orders = await myOrders(userId);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Buyurtmalar</h1>
      {orders.length === 0 && <p className="card text-center text-mute">Hali buyurtma yo&apos;q. Yurist suhbatda narx taklif qilganda shu yerda paydo bo&apos;ladi.</p>}
      <ul className="space-y-2">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/app/buyurtmalar/${o.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-brand/40">
              <span className="min-w-0">
                <b className="block truncate">{o.title}</b>
                <span className="text-sm text-mute">{o.role === "client" ? `Yurist: ${o.lawyer_name}` : `Mijoz: ${o.client_name}`} · {fmtUz(o.created_at)}</span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <b>{fmtSum(o.role === "client" ? o.amount_uzs : o.payout_uzs)}</b>
                <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${ORDER_STATUS[o.status].cls}`}>{ORDER_STATUS[o.status].label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
