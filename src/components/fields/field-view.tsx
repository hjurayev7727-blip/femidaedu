import Link from "next/link";
import { mastery, MASTERY_DOT, MASTERY_LABEL, percent, PRIORITY_LABEL } from "@/lib/fields";

export type FieldInfo = { slug: string; title: string; priority: string; color: string; icon: string };
export type FieldDoc = { id: number; title: string; short_title: string | null; lex_url: string | null };
export type FieldChapter = { id: number; document_id: number; number: string; title: string | null; sort: number };
export type FieldArticle = { id: number; number: string; title: string | null; chapter_id: number | null; status: string; questions: number; seen: number; correct: number; free: boolean };
export type LifeTopic = { id: number; title: string; article_ids: number[] };

/** Soha sahifasi: "Kodeks bo'yicha" (hujjat → bob → modda) va "Hayotiy mavzular" ko'rinishlari */
export function FieldView(props: {
  field: FieldInfo;
  view: "kodeks" | "hayotiy";
  docs: FieldDoc[];
  chapters: FieldChapter[];
  articlesByDoc: Map<number, FieldArticle[]>;
  topics: LifeTopic[];
  hrefBase?: string;
}) {
  const { field, view, docs, chapters, articlesByDoc, topics } = props;
  const base = `${props.hrefBase ?? "/app/sohalar"}/${field.slug}`;
  const all = [...articlesByDoc.values()].flat();
  const byId = new Map(all.map((a) => [a.id, a]));
  const mastered = all.filter((a) => mastery(a.seen, a.correct) === "ozlashtirildi").length;

  const tab = (v: "kodeks" | "hayotiy", label: string) => (
    <Link href={v === "kodeks" ? base : `${base}?korinish=hayotiy`}
      className={`rounded-xl px-4 py-2 text-sm font-bold ${view === v ? "bg-brand text-white" : "bg-card text-mute"}`}>{label}</Link>
  );
  const row = (a: FieldArticle) => {
    const m = mastery(a.seen, a.correct);
    return (
      <li key={a.id}>
        <Link href={`${base}/${a.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-brand-soft">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${MASTERY_DOT[m]}`} title={MASTERY_LABEL[m]} aria-label={MASTERY_LABEL[m]} />
          <span className="w-16 shrink-0 text-sm font-extrabold tabular-nums">{a.number}</span>
          <span className="min-w-0 flex-1 truncate text-[15px]">{a.title ?? "—"}</span>
          {a.status === "changed" && <span className="rounded-md bg-amber-soft px-2 py-0.5 text-xs font-bold text-amber">Yangi tahrir</span>}
          {a.questions > 0 && <span className="hidden text-xs text-mute sm:inline">{a.questions} savol</span>}
          {!a.free && <span className="text-xs" title="Testlar Premium'da" aria-label="Premium">🔒</span>}
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-hero relative overflow-hidden rounded-[22px] p-6 text-white">
        <span className="absolute inset-y-0 left-0 w-2" style={{ background: field.color }} aria-hidden />
        <Link href={props.hrefBase ?? "/app/sohalar"} className="text-sm font-bold text-gold-2 hover:underline">← Huquq sohalari</Link>
        <h1 className="mt-2 text-3xl font-bold"><span aria-hidden>{field.icon}</span> {field.title}</h1>
        <p className="mt-1 text-slate-300">{PRIORITY_LABEL[field.priority]}</p>
        {all.length > 0 && (
          <div className="mt-4 max-w-sm">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="bg-accent h-full rounded-full" style={{ width: `${percent(mastered, all.length)}%` }} />
            </div>
            <p className="mt-1.5 text-sm font-semibold text-gold-2">{mastered} / {all.length} modda o&apos;zlashtirilgan · {percent(mastered, all.length)}%</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">{tab("kodeks", "Kodeks bo'yicha")}{tab("hayotiy", "Hayotiy mavzular")}</div>

      {view === "kodeks" && (docs.length ? docs.map((d) => {
        const arts = articlesByDoc.get(d.id) ?? [];
        const loose = arts.filter((a) => a.chapter_id == null);
        return (
          <section key={d.id} className="card overflow-hidden p-0!">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-extrabold">{d.short_title ?? d.title}</h2>
              {d.lex_url && <a href={d.lex_url} target="_blank" rel="noopener" className="text-xs font-bold text-brand-2 hover:underline">lex.uz ↗</a>}
            </div>
            {chapters.filter((c) => c.document_id === d.id).map((c) => {
              const list = arts.filter((a) => a.chapter_id === c.id);
              if (!list.length) return null;
              return (
                <details key={c.id} className="border-b border-line last:border-b-0" open={c.sort === 1}>
                  <summary className="cursor-pointer px-4 py-2.5 text-sm font-bold text-brand-2">{c.number}-bob. {c.title}</summary>
                  <ul className="pb-2">{list.map(row)}</ul>
                </details>
              );
            })}
            {loose.length > 0 && <ul className="py-2">{loose.map(row)}</ul>}
          </section>
        );
      }) : <p className="card text-mute">Bu soha bo&apos;yicha qonun matni hali yuklanmagan. Tez orada qo&apos;shiladi.</p>)}

      {view === "hayotiy" && (topics.length ? topics.map((t) => (
        <section key={t.id} className="card overflow-hidden p-0!">
          <h2 className="border-b border-line px-4 py-3 font-extrabold">{t.title}</h2>
          <ul className="py-2">{t.article_ids.map((id) => byId.get(id)).filter((a): a is FieldArticle => Boolean(a)).map(row)}</ul>
        </section>
      )) : <p className="card text-mute">Hayotiy mavzular (masalan, &quot;Ishdan bo&apos;shatish&quot;, &quot;Meros&quot;) tez orada qo&apos;shiladi.</p>)}
    </div>
  );
}
