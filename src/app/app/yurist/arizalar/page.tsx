import type { Metadata } from "next";
import Link from "next/link";
import { replyRequest } from "@/app/app/suhbatlar/actions";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { myLawyerProfile } from "@/lib/lawyers-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Arizalar" };

type Item = { id: number; title: string; body: string; field: string | null; region: string | null; source: string; ai_snapshot: string | null; created_at: string; direct: boolean; new: boolean; conversation_id: string | null };

export default async function LawyerInbox({ searchParams }: PageProps<"/app/yurist/arizalar">) {
  const sp = await searchParams;
  const { userId } = await requireUser();
  const me = await myLawyerProfile(userId);
  if (!me) {
    return <p className="card mx-auto max-w-xl text-center">Arizalarni olish uchun avval <Link href="/app/yurist" className="font-bold text-brand-2 hover:underline">yurist profilini</Link> to&apos;ldiring.</p>;
  }
  const { data } = await createSupabaseAdmin().rpc("request_inbox", { p_lawyer: userId });
  const items = (data ?? []) as Item[];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yurist" className="hover:underline">Yurist kabineti</Link> › Arizalar</nav>
      <h1 className="text-2xl font-extrabold tracking-tight">Kelgan arizalar</h1>
      {typeof sp.xato === "string" && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{sp.xato.slice(0, 200)}</p>}
      {items.length === 0 && <p className="card text-center text-mute">Hozircha ochiq ariza yo&apos;q. Sohalaringizga mos ariza kelganda shu yerda va Telegram botda ko&apos;rasiz.</p>}
      {items.map((r) => (
        <article key={r.id} className="card space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-extrabold">{r.new && <span className="mr-2 rounded-md bg-brand px-1.5 py-0.5 text-xs text-white">yangi</span>}{r.title}</h2>
            <span className="text-xs text-mute">{fmtUz(r.created_at, { time: true, short: true })}</span>
          </div>
          <p className="text-xs text-mute">{[r.direct && "Sizga shaxsan", r.field, r.region, r.source === "ai" && "AI suhbatidan"].filter(Boolean).join(" · ")}</p>
          <p className="whitespace-pre-wrap text-sm">{r.body}</p>
          {r.ai_snapshot && (
            <details className="rounded-xl bg-bg p-3 text-sm">
              <summary className="cursor-pointer font-bold text-mute">AI yordamchi javobi</summary>
              <p className="mt-1 whitespace-pre-wrap">{r.ai_snapshot}</p>
            </details>
          )}
          {r.conversation_id ? (
            <Link href={`/app/suhbatlar/${r.conversation_id}`} className="btn-ghost">Suhbatga o&apos;tish →</Link>
          ) : (
            <form action={replyRequest}><input type="hidden" name="request" value={r.id} /><button className="btn-primary">Javob berish</button></form>
          )}
        </article>
      ))}
    </div>
  );
}
