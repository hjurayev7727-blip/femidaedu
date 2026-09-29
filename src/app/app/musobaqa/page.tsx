import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { fmtWhen, serverNow } from "@/lib/dates";

export const metadata: Metadata = { title: "Musobaqalar" };

type Contest = { id: number; title: string; starts_at: string; ends_at: string; is_premium: boolean; finalized: boolean };

export default async function Contests() {
  const { supabase, userId } = await requireUser();
  const [{ data: contests }, { data: mine }] = await Promise.all([
    supabase.from("contests").select("id, title, starts_at, ends_at, is_premium, finalized").order("starts_at", { ascending: false }).limit(30).returns<Contest[]>(),
    supabase.from("contest_entries").select("contest_id, rank").eq("user_id", userId).returns<{ contest_id: number; rank: number | null }[]>(),
  ]);
  const now = serverNow();
  const my = new Map((mine ?? []).map((m) => [m.contest_id, m]));
  const active = (contests ?? []).filter((c) => Date.parse(c.starts_at) <= now && now < Date.parse(c.ends_at));
  const upcoming = (contests ?? []).filter((c) => Date.parse(c.starts_at) > now).reverse();
  const past = (contests ?? []).filter((c) => Date.parse(c.ends_at) <= now);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Musobaqalar</h1>
        <p className="mt-1 text-mute">Hamma bir vaqtda bir xil savollarni ishlaydi. Javoblar va natijalar musobaqa tugagach ochiladi.</p>
      </div>
      {active.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[.12em] text-ok">● Hozir bo&apos;lyapti</h2>
          <ul className="card divide-y divide-line border-2 border-ok p-0!">{active.map((c) => <Row key={c.id} c={c} entry={my.get(c.id)} label={`${fmtWhen(c.ends_at)} gacha`} />)}</ul>
        </section>
      )}
      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[.12em] text-mute">Rejada</h2>
          <ul className="card divide-y divide-line p-0!">{upcoming.map((c) => <Row key={c.id} c={c} entry={my.get(c.id)} label={fmtWhen(c.starts_at)} />)}</ul>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-extrabold uppercase tracking-[.12em] text-mute">O&apos;tganlar</h2>
          <ul className="card divide-y divide-line p-0!">{past.map((c) => <Row key={c.id} c={c} entry={my.get(c.id)} label={fmtWhen(c.starts_at)} />)}</ul>
        </section>
      )}
      {!contests?.length && <p className="card text-mute">Hozircha musobaqa e&apos;lon qilinmagan. Bot orqali xabar olasiz.</p>}
    </div>
  );
}

function Row({ c, label, entry: e }: { c: Contest; label: string; entry?: { rank: number | null } }) {
  return (
    <li>
      <Link href={`/app/musobaqa/${c.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-bg">
        <span>
          <span className="block font-bold">{c.title} {c.is_premium && <span className="tag ml-1">Premium</span>}</span>
          <span className="text-sm text-mute">{label}</span>
        </span>
        <span className="text-sm font-bold">{e?.rank ? `🏅 ${e.rank}-o'rin` : e ? "qatnashdingiz" : "→"}</span>
      </Link>
    </li>
  );
}
