import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { closeRequest } from "./actions";

export const metadata: Metadata = { title: "Suhbatlar" };

type Conv = { id: string; role: "client" | "lawyer"; other: string; request_title: string | null; last_message_at: string; last: string | null; unread: number };
type Req = { id: number; title: string; field: string | null; status: string; created_at: string; recipients: number; replies: number };

export default async function Conversations({ searchParams }: PageProps<"/app/suhbatlar">) {
  const sp = await searchParams;
  const { userId } = await requireUser();
  const admin = createSupabaseAdmin();
  const [{ data: convs }, { data: reqs }] = await Promise.all([
    admin.rpc("my_conversations", { p_user: userId }),
    admin.rpc("my_requests", { p_user: userId }),
  ]);
  const list = (convs ?? []) as Conv[];
  const open = ((reqs ?? []) as Req[]).filter((r) => r.status === "open");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Suhbatlar</h1>
        <div className="flex gap-2">
          <Link href="/app/buyurtmalar" className="btn-ghost">🧾 Buyurtmalar</Link>
          <Link href="/app/yuristlar/ariza" className="btn-primary">📩 Yangi ariza</Link>
        </div>
      </div>
      {typeof sp.xato === "string" && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{sp.xato.slice(0, 200)}</p>}

      {open.length > 0 && (
        <section className="card !p-0">
          <h2 className="px-5 pt-4 font-extrabold">Ochiq arizalarim</h2>
          <ul className="mt-2 divide-y divide-line">
            {open.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <span className="min-w-0">
                  <b className="block truncate">{r.title}</b>
                  <span className="text-xs text-mute">{fmtUz(r.created_at)} · {r.recipients ? `${r.recipients} ta yuristga yuborildi` : "mos yurist qidirilmoqda"} · {r.replies} ta javob</span>
                </span>
                <form action={closeRequest}><input type="hidden" name="request" value={r.id} /><button className="btn-ghost !py-1.5 !text-sm">Yopish</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {list.length ? (
        <ul className="card divide-y divide-line !p-0">
          {list.map((c) => (
            <li key={c.id}>
              <Link href={`/app/suhbatlar/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-bg">
                <span className="min-w-0">
                  <b className="block truncate">{c.role === "lawyer" ? "👤 " : "⚖️ "}{c.other}{c.request_title && <span className="font-normal text-mute"> · {c.request_title}</span>}</b>
                  <span className="block truncate text-sm text-mute">{c.last ?? "—"}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-mute">{fmtUz(c.last_message_at, { short: true })}</span>
                  {c.unread > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">{c.unread}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-center text-mute">Hali suhbat yo&apos;q. <Link href="/app/yuristlar" className="font-bold text-brand-2 hover:underline">Yuristlar katalogidan</Link> tanlang yoki ariza qoldiring.</p>
      )}
    </div>
  );
}
