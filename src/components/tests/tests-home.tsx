import Link from "next/link";
import { fmtUz } from "@/lib/dates";
import { VISIBILITY_LABEL, type Visibility } from "@/lib/user-tests";

export type MyTest = {
  id: number; title: string; share_code: string; visibility: Visibility; status: string;
  attempts_count: number; rating_sum: number; rating_n: number; created_at: string; items?: number;
};
export type GroupTest = { code: string; title: string; group_name: string; items: number; closes_at: string | null; finished: boolean };

const STATUS: Record<string, [string, string]> = {
  draft: ["Qoralama", "bg-amber-soft text-amber"],
  published: ["Nashr qilingan", "bg-ok-soft text-ok"],
  hidden: ["Yopilgan", "bg-line text-mute"],
  removed: ["O'chirilgan", "bg-line text-mute"],
};

const fmt = (iso: string) => fmtUz(iso, { time: false, short: true });

/** "Testlar" bosh sahifasi: kod bilan ochish, o'z testlari, guruh testlari, haftalik AI limiti */
export function TestsHome(props: {
  tests: MyTest[];
  groupTests: GroupTest[];
  weekUsed: number;
  weekLimit: number | null;
  premium: boolean;
  codeError?: boolean;
  openByCode?: (form: FormData) => Promise<void>;
  hrefBase?: string;
}) {
  const base = props.hrefBase ?? "/app/testlar";
  return (
    <div className="space-y-6">
      <section className="bg-hero relative overflow-hidden rounded-[22px] p-6 text-white">
        <p className="tag !bg-white/10 !text-gold-2">Testlar</p>
        <h1 className="mt-3 text-3xl font-bold">AI bilan test yarating va ulashing</h1>
        <p className="mt-2 max-w-xl text-slate-300">
          Moddalar, o&apos;z matningiz, PDF yoki rasmdan — bir daqiqada. Havola, kod yoki Telegram orqali ulashing, natijalarni kuzating.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={`${base}/yangi`} className="btn-primary">🤖 Yangi test</Link>
          <Link href="/t" className="btn border-2 border-white/20 text-white">Ochiq katalog</Link>
          <span className="text-sm text-slate-300">
            {props.weekLimit == null ? "Cheksiz" : `Bu hafta: ${props.weekUsed}/${props.weekLimit} AI test`}
            {!props.premium && " · bepul tarif (10 tagacha savol)"}
          </span>
        </div>
      </section>

      <form action={props.openByCode} className="card flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-bold">
          Test kodi
          <input name="code" required maxLength={8} autoComplete="off" placeholder="K7Q2XM"
            className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 font-mono text-lg font-bold uppercase tracking-[.3em] outline-none focus:border-brand" />
        </label>
        <button className="btn-ghost">Ochish</button>
        {props.codeError && <p role="alert" className="w-full text-sm font-semibold text-no">Kod 6 belgidan iborat (masalan, K7Q2XM).</p>}
      </form>

      {props.groupTests.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Guruhdagi testlar</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {props.groupTests.map((t) => (
              <li key={t.code}>
                <Link href={`/t/${t.code}`} className="card flex items-center justify-between gap-3 hover:border-brand/40">
                  <span>
                    <b className="block">{t.title}</b>
                    <span className="text-sm text-mute">{t.group_name} · {t.items} savol{t.closes_at ? ` · ${fmt(t.closes_at)} gacha` : ""}</span>
                  </span>
                  <span className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${t.finished ? "bg-ok-soft text-ok" : "bg-gold-soft text-gold"}`}>
                    {t.finished ? "Ishlangan" : "Yangi"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Mening testlarim</h2>
        {props.tests.length === 0 ? (
          <div className="card text-center text-mute">
            <p className="text-4xl" aria-hidden>📝</p>
            <p className="mt-2 font-semibold">Hali test yaratmadingiz.</p>
            <p className="text-sm">Sohalar bo&apos;limidagi istalgan moddadan yoki o&apos;z konspektingizdan boshlang.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {props.tests.map((t) => {
              const [label, cls] = STATUS[t.status] ?? STATUS.draft;
              return (
                <li key={t.id}>
                  <Link href={`${base}/${t.id}`} className="card flex flex-wrap items-center justify-between gap-3 !py-4 hover:border-brand/40">
                    <span className="min-w-0">
                      <b className="block truncate">{t.title}</b>
                      <span className="text-sm text-mute">
                        {fmt(t.created_at)}{t.items != null ? ` · ${t.items} savol` : ""} · {VISIBILITY_LABEL[t.visibility].title}
                        {t.attempts_count > 0 && ` · ${t.attempts_count} marta ishlangan`}
                        {t.rating_n > 0 && ` · ★ ${(t.rating_sum / t.rating_n).toFixed(1)}`}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <code className="rounded-md bg-brand-soft px-2 py-1 font-mono text-xs font-bold tracking-widest text-brand-2">{t.share_code}</code>
                      <span className={`rounded-md px-2 py-1 text-xs font-bold ${cls}`}>{label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
