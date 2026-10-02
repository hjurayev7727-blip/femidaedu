import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { REGIONS } from "../profil/regions";

export const metadata: Metadata = { title: "Reyting" };

type Row = { rank: number; name: string; region: string | null; answered: number; accuracy: number; score: number; is_me: boolean };

export default async function Leaderboard({ searchParams }: PageProps<"/app/reyting">) {
  const { supabase, profile } = await requireUser();
  const sp = await searchParams;
  const period = sp.davr === "umumiy" ? "all" : "week";
  const region = (REGIONS as readonly string[]).includes(String(sp.hudud)) ? String(sp.hudud) : null;
  const { data } = await supabase.rpc("leaderboard", { p_period: period, p_region: region, p_limit: 50 });
  const rows = (data ?? []) as Row[];
  const me = rows.find((r) => r.is_me);
  const q = (p: Record<string, string | null>) => {
    const u = new URLSearchParams();
    const davr = "davr" in p ? p.davr : period === "all" ? "umumiy" : null;
    const hudud = "hudud" in p ? p.hudud : region;
    if (davr) u.set("davr", davr);
    if (hudud) u.set("hudud", hudud);
    return `/app/reyting${u.size ? `?${u}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Reyting</h1>
        <p className="mt-1 text-sm text-mute">
          Ball = aniqlik × 0,7 + faollik × 0,3. Reytingga kirish uchun {period === "week" ? "haftada kamida 20" : "jami kamida 100"} ta javob kerak.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[["week", "Bu hafta", null], ["all", "Umumiy", "umumiy"]].map(([p, label, v]) => (
          <Link key={p} href={q({ davr: v })} className={`rounded-xl px-4 py-2 text-sm font-bold ${period === p ? "bg-accent text-white" : "bg-card text-mute"}`}>
            {label}
          </Link>
        ))}
        <form action="/app/reyting" className="ml-auto flex items-center gap-2">
          {period === "all" && <input type="hidden" name="davr" value="umumiy" />}
          <select name="hudud" defaultValue={region ?? ""} aria-label="Hudud" className="rounded-xl border-2 border-line bg-card px-3 py-2 text-sm font-semibold">
            <option value="">Butun O&apos;zbekiston</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn-ghost px-3! py-2! text-sm!">Ko&apos;rsatish</button>
        </form>
      </div>

      {me ? (
        <div className="bg-hero flex items-center justify-between rounded-[18px] px-5 py-4 text-white">
          <span className="font-bold">Sizning o&apos;rningiz</span>
          <span className="text-2xl font-extrabold tabular-nums">#{me.rank} <span className="text-base text-slate-300">· {Number(me.score)} ball</span></span>
        </div>
      ) : (
        <p className="card text-sm text-mute">
          {profile.region ? "" : "Profilda hududingizni tanlang. "}Siz hali bu reytingda yo&apos;qsiz — ko&apos;proq mashq qiling!
        </p>
      )}

      <ol className="card divide-y divide-line p-0!">
        {rows.filter((r) => r.rank <= 50).map((r) => (
          <li key={`${r.rank}-${r.name}-${r.answered}`} className={`flex items-center gap-3 px-5 py-3 ${r.is_me ? "bg-brand-soft" : ""}`}>
            <span className="w-8 text-center font-extrabold tabular-nums">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{r.name}{r.is_me && " (siz)"}</span>
              <span className="text-xs text-mute">{r.region ?? "—"} · {r.answered} javob · {Number(r.accuracy)}%</span>
            </span>
            <span className="font-extrabold tabular-nums">{Number(r.score)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="px-5 py-4 text-sm text-mute">Hozircha reytingda hech kim yo&apos;q.</li>}
      </ol>
      <p className="text-center text-xs text-mute">
        Reytingda faqat ism va familiyaning bosh harfi ko&apos;rinadi. <Link href="/app/profil" className="underline">Reytingdan chiqish</Link>
      </p>
    </div>
  );
}
