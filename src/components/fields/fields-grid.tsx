import Link from "next/link";
import { percent, PRIORITY_LABEL } from "@/lib/fields";

export type FieldCard = { slug: string; title: string; priority: "A" | "B" | "C"; color: string; icon: string; documents: number; articles: number; mastered: number; questions: number };

const GROUPS: { priority: FieldCard["priority"]; title: string }[] = [
  { priority: "A", title: "Asosiy sohalar" },
  { priority: "B", title: "Muhim sohalar" },
  { priority: "C", title: "Tanishuv uchun" },
];

/** Huquq sohalari katalogi (ko'rinish; ma'lumot sahifada olinadi) */
export function FieldsGrid({ fields, hrefBase = "/app/sohalar" }: { fields: FieldCard[]; hrefBase?: string }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Huquq sohalari</h1>
        <p className="mt-1 text-mute">Istalgan sohani mustaqil o&apos;rganing: kodeks moddalari, har moddaga test va o&apos;zlashtirish xaritasi.</p>
      </div>
      {GROUPS.map((g) => {
        const list = fields.filter((f) => f.priority === g.priority);
        if (!list.length) return null;
        return (
          <section key={g.priority}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-extrabold">{g.title}</h2>
              <span className="text-xs font-semibold text-mute">{PRIORITY_LABEL[g.priority]}</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((f) => {
                const pct = percent(f.mastered, f.articles);
                return (
                  <Link key={f.slug} href={`${hrefBase}/${f.slug}`} className="card group relative overflow-hidden transition-transform hover:-translate-y-0.5">
                    <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: f.color }} aria-hidden />
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-2xl" aria-hidden>{f.icon}</span>
                      <span className="tag">{f.priority}</span>
                    </div>
                    <h3 className="mt-3 font-extrabold group-hover:underline">{f.title}</h3>
                    <p className="mt-1 text-sm text-mute">
                      {f.articles ? `${f.documents} hujjat · ${f.articles} modda · ${f.questions} savol` : "Tez orada — qonun matni yuklanmoqda"}
                    </p>
                    {f.articles > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="O'zlashtirilgan moddalar">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: f.color }} />
                        </div>
                        <p className="mt-1 text-xs font-semibold text-mute">{pct}% o&apos;zlashtirilgan</p>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
