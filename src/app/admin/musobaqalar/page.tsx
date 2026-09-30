import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { fmtWhen } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { createContest } from "./actions";

export const metadata: Metadata = { title: "Musobaqalar" };
// E'lon bot orqali ko'p foydalanuvchiga yuboriladi
export const maxDuration = 300;

type Row = { id: number; title: string; starts_at: string; ends_at: string; is_premium: boolean; finalized: boolean; question_ids: number[]; contest_entries: { count: number }[] };
type Topic = { slug: string; title: string; parent_id: number | null; id: number };

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand";

export default async function AdminContests({ searchParams }: PageProps<"/admin/musobaqalar">) {
  await requireRole("admin");
  const sp = await searchParams;
  const admin = createSupabaseAdmin();
  const [{ data: rows }, { data: topics }] = await Promise.all([
    admin.from("contests").select("id, title, starts_at, ends_at, is_premium, finalized, question_ids, contest_entries(count)").order("starts_at", { ascending: false }).limit(30).returns<Row[]>(),
    admin.from("topics").select("id, slug, title, parent_id").order("sort").returns<Topic[]>(),
  ]);
  const modules = (topics ?? []).filter((t) => t.parent_id == null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Musobaqalar</h1>
      {sp.xato && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">Xato: {String(sp.xato)}</p>}
      {sp.yaratildi && (
        <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
          Musobaqa yaratildi ✓ {Number(sp.yuborildi) > 0 && `· botda ${sp.yuborildi} kishiga e'lon qilindi`}
        </p>
      )}

      <form action={createContest} className="card grid gap-3 sm:grid-cols-2">
        <h2 className="font-extrabold sm:col-span-2">Yangi musobaqa</h2>
        <label className="text-sm font-bold sm:col-span-2">Nomi
          <input name="title" required maxLength={80} placeholder="Shanba blitsi — Konstitutsiya" className={field} />
        </label>
        <label className="text-sm font-bold">Sana
          <input name="date" type="date" required className={field} />
        </label>
        <label className="text-sm font-bold">Boshlanish (Toshkent)
          <input name="time" type="time" required defaultValue="20:00" className={field} />
        </label>
        <label className="text-sm font-bold">Davomiyligi (daqiqa)
          <input name="duration" type="number" min={5} max={180} defaultValue={20} className={field} />
        </label>
        <label className="text-sm font-bold">Savollar soni
          <input name="count" type="number" min={5} max={50} defaultValue={20} className={field} />
        </label>
        <label className="text-sm font-bold sm:col-span-2">Mavzu (ixtiyoriy)
          <select name="topic" defaultValue="" className={field}>
            <option value="">Barcha mavzular</option>
            {modules.map((m) => (
              <optgroup key={m.id} label={m.title}>
                <option value={m.slug}>{m.title}</option>
                {(topics ?? []).filter((t) => t.parent_id === m.id).map((t) => <option key={t.slug} value={t.slug}>{t.title}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="premium" className="accent-brand" /> Faqat Premium</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="announce" defaultChecked className="accent-brand" /> Botda e&apos;lon qilish</label>
        <button className="btn-primary sm:col-span-2">Yaratish</button>
      </form>

      <ul className="card divide-y divide-line p-0!">
        {(rows ?? []).map((c) => (
          <li key={c.id}>
            <Link href={`/app/musobaqa/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-bg">
              <span>
                <span className="block font-bold">{c.title}{c.is_premium && " · Premium"}</span>
                <span className="text-xs text-mute">{fmtWhen(c.starts_at)} — {fmtWhen(c.ends_at)} · {c.question_ids.length} savol</span>
              </span>
              <span className="text-sm font-bold">{c.contest_entries[0]?.count ?? 0} ishtirokchi{c.finalized && " · yakunlangan"}</span>
            </Link>
          </li>
        ))}
        {!rows?.length && <li className="px-5 py-4 text-sm text-mute">Hali musobaqa yo&apos;q.</li>}
      </ul>
    </div>
  );
}
