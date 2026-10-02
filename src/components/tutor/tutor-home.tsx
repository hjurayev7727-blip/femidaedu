import Link from "next/link";
import type { ReactNode } from "react";
import { fmtUz } from "@/lib/dates";
import { MODE_INFO } from "@/lib/tutor";
import type { TutorMode } from "@/lib/ai";

export type ThreadRow = { id: string; mode: TutorMode; title: string; updated_at: string };
export type WeakRow = { article_id: number; number: string; title: string | null; doc_title: string; field_slug: string | null; seen: number; correct: number };

/** AI yordamchi bosh sahifasi: yangi suhbat, xatolardan test, o'quv reja, oldingi suhbatlar */
export function TutorHome(props: {
  chat: ReactNode;
  threads: ThreadRow[];
  weak: WeakRow[];
  weekUsed: number;
  weekLimit: number;
  premium: boolean;
  hasPlan: boolean;
  error?: string;
  mistakesAction?: () => Promise<void>;
  base?: string;
}) {
  const base = props.base ?? "/app/yordamchi";
  return (
    <div className="space-y-6">
      <section className="bg-hero rounded-[22px] p-6 text-white">
        <p className="tag !bg-white/10 !text-gold-2">AI yordamchi</p>
        <h1 className="mt-3 text-3xl font-bold">Savol bering — bazadagi moddalar asosida tushuntiraman</h1>
        <p className="mt-2 text-sm text-slate-300">
          Bu hafta: {props.weekUsed}/{props.weekLimit} savol{!props.premium && " · bepul tarif"} · faqat ta&apos;lim maqsadida, yuridik maslahat emas
        </p>
      </section>

      {props.error && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{props.error}</p>}

      {props.chat}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="text-xl font-bold">🎯 Xatolardan test</h2>
          {props.weak.length ? (
            <>
              <ul className="space-y-1 text-sm">
                {props.weak.slice(0, 5).map((w) => (
                  <li key={w.article_id} className="flex justify-between gap-2">
                    {w.field_slug ? <Link href={`/app/sohalar/${w.field_slug}/${w.article_id}`} className="truncate hover:underline">{w.doc_title} {w.number}-modda</Link>
                      : <span className="truncate">{w.doc_title} {w.number}-modda</span>}
                    <span className="shrink-0 font-bold text-no">{w.seen - w.correct} xato</span>
                  </li>
                ))}
              </ul>
              <form action={props.mistakesAction}>
                <button className="btn-primary !py-2.5">AI test yaratish</button>
              </form>
              <p className="text-xs text-mute">Haftalik AI test limitiga kiradi.</p>
            </>
          ) : <p className="text-sm text-mute">Hali xato qilingan moddalar yo&apos;q. Sohalar bo&apos;yicha test ishlang — zaif joylar shu yerda chiqadi.</p>}
        </section>

        <section className="card space-y-3">
          <h2 className="text-xl font-bold">🗓️ O&apos;quv reja</h2>
          <p className="text-sm text-mute">Maqsad va kunlik vaqtingizga qarab haftalik reja: qaysi moddalar, qancha test, qachon sinov imtihoni.</p>
          <Link href={`${base}/reja`} className="btn-ghost !py-2.5">{props.hasPlan ? "Rejamni ochish" : "Reja tuzish"}</Link>
        </section>
      </div>

      {props.threads.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Oldingi suhbatlar</h2>
          <ul className="space-y-2">
            {props.threads.map((t) => (
              <li key={t.id}>
                <Link href={`${base}/${t.id}`} className="card flex items-center justify-between gap-3 !py-3 hover:border-brand/40">
                  <span className="truncate"><span aria-hidden>{MODE_INFO[t.mode].icon}</span> {t.title}</span>
                  <span className="shrink-0 text-xs text-mute">{fmtUz(t.updated_at, { short: true })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
