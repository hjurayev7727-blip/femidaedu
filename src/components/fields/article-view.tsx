import Link from "next/link";
import type { ReactNode } from "react";
import { articleHeading, mastery, MASTERY_DOT, MASTERY_LABEL, paragraphs } from "@/lib/fields";

export type ArticleData = { id: number; number: string; title: string | null; body: string; status: string };
export type ArticleNav = { id: number; number: string };

export const ARTICLE_ERRORS: Record<string, string> = {
  premium: "Bu modda bo'yicha testlar Premium'da. Har sohaning 1-bobi va C darajali sohalar bepul.",
  bosh: "Bu modda bo'yicha hali savol yo'q — AI testlar qismida qo'shiladi.",
  topilmadi: "Modda topilmadi.",
  server: "Mashqni boshlab bo'lmadi. Qayta urinib ko'ring.",
};

/** Modda sahifasi. `action` — test tugmasi (server action formasi yoki Premium havolasi) */
export function ArticleView(props: {
  article: ArticleData;
  field: { slug: string; title: string; color: string };
  doc: { title: string; short_title: string | null; lex_url: string | null };
  prev: ArticleNav | null;
  next: ArticleNav | null;
  progress: { seen: number; correct: number };
  questions: number;
  locked: boolean;
  error?: string;
  action: ReactNode;
  hrefBase?: string;
}) {
  const { article: a, field, doc, prev, next } = props;
  const base = `${props.hrefBase ?? "/app/sohalar"}/${field.slug}`;
  const m = mastery(props.progress.seen, props.progress.correct);

  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <nav className="text-sm font-semibold text-mute" aria-label="Yo'l">
        <Link href={props.hrefBase ?? "/app/sohalar"} className="hover:underline">Sohalar</Link> ›{" "}
        <Link href={base} className="hover:underline">{field.title}</Link> › {doc.short_title ?? doc.title}
      </nav>

      <header className="card relative overflow-hidden">
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: field.color }} aria-hidden />
        <h1 className="text-2xl font-bold leading-snug">{articleHeading(a)}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="flex items-center gap-1.5 font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${MASTERY_DOT[m]}`} aria-hidden /> {MASTERY_LABEL[m]}</span>
          {a.status === "changed" && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">Yangi tahrir — savollar tekshirilmoqda</span>}
          {doc.lex_url && <a href={doc.lex_url} target="_blank" rel="noopener" className="font-bold text-brand-2 hover:underline">Rasmiy matn (lex.uz) ↗</a>}
        </div>
      </header>

      <div className="card space-y-3 text-[16px] leading-relaxed">
        {paragraphs(a.body).map((p, k) => <p key={k}>{p}</p>)}
      </div>

      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-extrabold">Shu modda bo&apos;yicha test</p>
          <p className="text-sm text-mute">{props.questions ? `${props.questions} ta savol` : "Savollar tez orada qo'shiladi"}{props.locked ? " · Premium" : ""}</p>
        </div>
        {props.action}
      </div>
      {props.error && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{props.error}</p>}

      <div className="flex justify-between gap-3 text-sm font-bold">
        {prev ? <Link href={`${base}/${prev.id}`} className="btn-ghost">← {prev.number}-modda</Link> : <span />}
        {next ? <Link href={`${base}/${next.id}`} className="btn-ghost">{next.number}-modda →</Link> : <span />}
      </div>
    </article>
  );
}
