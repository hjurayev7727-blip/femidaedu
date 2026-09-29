import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { startPractice } from "./actions";

export const metadata: Metadata = { title: "Mashq" };

type Topic = { id: number; parent_id: number | null; slug: string; title: string; sort: number; document_id: number | null };
type Doc = { id: number; number: number; priority: "A" | "B" | "C" | null };

const ERRORS: Record<string, string> = {
  bosh: "Bu mavzu bo'yicha hozircha savol yo'q.",
  mavzu: "Mavzu topilmadi.",
  server: "Mashqni boshlab bo'lmadi. Qayta urinib ko'ring.",
};

const PRIORITY_HINT: Record<string, string> = { A: "Imtihonda ko'p uchraydi", B: "O'rtacha uchraydi", C: "Kamroq uchraydi" };

export default async function PracticeCatalog({ searchParams }: PageProps<"/app/mashq">) {
  const { supabase } = await requireUser();
  const sp = await searchParams;

  const [{ data: topics }, { data: docs }, { data: counts }, { data: progress }] = await Promise.all([
    supabase.from("topics").select("id, parent_id, slug, title, sort, document_id").order("sort").returns<Topic[]>(),
    supabase.from("documents").select("id, number, priority").returns<Doc[]>(),
    supabase.rpc("topic_question_counts"),
    supabase.rpc("my_topic_progress"),
  ]);
  const countRows = (counts ?? []) as { topic_id: number; total: number }[];
  const progressRows = (progress ?? []) as { topic_id: number; answered: number; correct: number }[];

  const all = topics ?? [];
  const docById = new Map((docs ?? []).map((d) => [d.id, d]));
  const total = new Map(countRows.map((c) => [c.topic_id, Number(c.total)]));
  const prog = new Map(progressRows.map((p) => [p.topic_id, { answered: Number(p.answered), correct: Number(p.correct) }]));
  const children = (id: number) => all.filter((t) => t.parent_id === id);
  // Ota mavzu uchun — o'zi va ichidagilar yig'indisi
  const sum = (t: Topic): { total: number; answered: number; correct: number } =>
    [t, ...children(t.id)].reduce(
      (acc, x) => {
        if (x.id !== t.id) {
          const s = sum(x);
          return { total: acc.total + s.total, answered: acc.answered + s.answered, correct: acc.correct + s.correct };
        }
        const p = prog.get(x.id);
        return { total: acc.total + (total.get(x.id) ?? 0), answered: acc.answered + (p?.answered ?? 0), correct: acc.correct + (p?.correct ?? 0) };
      },
      { total: 0, answered: 0, correct: 0 },
    );

  const roots = all.filter((t) => t.parent_id == null && sum(t).total > 0);
  const modules = roots.filter((t) => t.slug.startsWith("modul-"));
  const textbooks = roots.filter((t) => t.slug.startsWith("darslik-"));
  const error = ERRORS[String(sp.xato ?? "")];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Mashq</h1>
        <p className="mt-1 text-mute">Mavzuni tanlang — har mashqda 10 ta savol, avval hali ko&apos;rmaganlaringiz beriladi.</p>
        {error && <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{error}</p>}
      </div>

      {!roots.length && (
        <div className="card text-mute">Savollar bazasi hali yuklanmagan (README → “Savollarni yuklash”).</div>
      )}

      {modules.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[.12em] text-mute">Qonunchilik hujjatlari</h2>
          {modules.map((m) => (
            <Group key={m.id} topic={m} stats={sum(m)}>
              {children(m.id)
                .filter((d) => (total.get(d.id) ?? 0) > 0)
                .map((d) => {
                  const doc = d.document_id ? docById.get(d.document_id) : undefined;
                  return <Row key={d.id} topic={d} stats={sum(d)} number={doc?.number} priority={doc?.priority ?? null} />;
                })}
            </Group>
          ))}
        </section>
      )}

      {textbooks.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[.12em] text-mute">Darsliklar</h2>
          {textbooks.map((tb) => (
            <Group key={tb.id} topic={tb} stats={sum(tb)}>
              {children(tb.id).filter((c) => (total.get(c.id) ?? 0) > 0).map((c) => (
                <Row key={c.id} topic={c} stats={sum(c)} />
              ))}
            </Group>
          ))}
        </section>
      )}
    </div>
  );
}

function StartButton({ slug, label, primary }: { slug: string; label: string; primary?: boolean }) {
  return (
    <form action={startPractice}>
      <input type="hidden" name="slug" value={slug} />
      <button className={primary ? "btn-primary px-4! py-2.5! text-sm!" : "btn-ghost px-3.5! py-2! text-sm!"}>{label}</button>
    </form>
  );
}

function Meter({ stats }: { stats: { total: number; answered: number; correct: number } }) {
  const acc = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
  const covered = Math.min(100, Math.round((stats.answered / Math.max(stats.total, 1)) * 100));
  return (
    <div className="mt-1.5 flex items-center gap-2 text-xs text-mute">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="bg-accent h-full" style={{ width: `${covered}%` }} />
      </div>
      <span>
        {stats.total} savol
        {acc != null && (
          <> · <b className={acc >= 70 ? "text-ok" : acc >= 50 ? "text-amber" : "text-no"}>{acc}%</b> to&apos;g&apos;ri</>
        )}
      </span>
    </div>
  );
}

function Group({ topic, stats, children }: { topic: Topic; stats: { total: number; answered: number; correct: number }; children: React.ReactNode }) {
  return (
    <details className="card p-0! [&[open]>summary_.chev]:rotate-90" open={topic.slug === "modul-1"}>
      <summary className="flex cursor-pointer list-none items-center gap-3 p-5">
        <span className="chev text-mute transition-transform" aria-hidden>▶</span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold tracking-tight">{topic.title}</p>
          <Meter stats={stats} />
        </div>
        <StartButton slug={topic.slug} label="Aralash" primary />
      </summary>
      <ul className="divide-y divide-line border-t border-line">{children}</ul>
    </details>
  );
}

function Row({ topic, stats, number, priority }: {
  topic: Topic; stats: { total: number; answered: number; correct: number }; number?: number; priority?: "A" | "B" | "C" | null;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      {number != null && <span className="w-8 shrink-0 text-sm font-extrabold text-mute tabular-nums">№{number}</span>}
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-snug">
          {topic.title}
          {priority && (
            <span title={PRIORITY_HINT[priority]} className={`ml-2 rounded-md px-1.5 py-0.5 align-middle text-[10px] font-extrabold
              ${priority === "A" ? "bg-cyan-soft text-cyan-2" : "bg-bg text-mute"}`}>{priority}</span>
          )}
        </p>
        <Meter stats={stats} />
      </div>
      <StartButton slug={topic.slug} label="Boshlash" />
    </li>
  );
}
