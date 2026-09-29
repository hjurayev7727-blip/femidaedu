import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAssignment, deleteAssignment, regenerateInvite, removeMember } from "../actions";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Guruh" };

type Stat = {
  user_id: string; full_name: string; telegram_username: string | null; streak_days: number; last_active_on: string | null;
  answered_7d: number; correct_7d: number; answered_total: number; correct_total: number; review_due: number;
  last_mock_grade: string | null; last_mock_scaled: number | null;
};
type Weak = { document_number: number; title: string; answered: number; correct: number; students: number };
type Assignment = { id: number; title: string; question_count: number; due_at: string | null; created_at: string; topics: { title: string } | null };
type Topic = { slug: string; title: string; parent_id: number | null; id: number; document_id: number | null };

const pct = (c: number, a: number) => (a ? Math.round((c / a) * 100) : null);
const tone = (p: number | null) => (p == null ? "text-mute" : p >= 70 ? "text-ok" : p >= 50 ? "text-amber" : "text-no");
const fmtDate = (s: string) => new Date(s).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "short" });

export default async function GroupPage({ params, searchParams }: PageProps<"/app/ustoz/[id]">) {
  const { id: raw } = await params;
  const id = z.coerce.number().int().positive().safeParse(raw);
  if (!id.success) notFound();
  const { supabase } = await requireRole("teacher", "admin");
  const sp = await searchParams;

  const { data: group } = await supabase.from("groups").select("id, name, invite_code, grants_premium").eq("id", id.data)
    .maybeSingle<{ id: number; name: string; invite_code: string; grants_premium: boolean }>();
  if (!group) notFound();

  const [{ data: stats, error: statsErr }, { data: weak }, { data: assignments }, { data: topics }] = await Promise.all([
    supabase.rpc("group_stats", { p_group: group.id }),
    supabase.rpc("group_weak_topics", { p_group: group.id }),
    supabase.from("assignments").select("id, title, question_count, due_at, created_at, topics(title)").eq("group_id", group.id)
      .order("created_at", { ascending: false }).returns<Assignment[]>(),
    supabase.from("topics").select("id, slug, title, parent_id, document_id").order("sort").returns<Topic[]>(),
  ]);
  if (statsErr) notFound(); // egasi emas (forbidden)
  const members = (stats ?? []) as Stat[];
  const weakRows = (weak ?? []) as Weak[];

  const asgIds = (assignments ?? []).map((a) => a.id);
  const { data: done } = asgIds.length
    ? await supabase.from("attempts").select("assignment_id, finished_at").in("assignment_id", asgIds).returns<{ assignment_id: number; finished_at: string | null }[]>()
    : { data: [] };
  const doneBy = new Map<number, number>();
  for (const d of done ?? []) if (d.finished_at) doneBy.set(d.assignment_id, (doneBy.get(d.assignment_id) ?? 0) + 1);

  const modules = (topics ?? []).filter((t) => t.parent_id == null);
  const invite = `${env().NEXT_PUBLIC_SITE_URL}/app/qoshilish/${group.invite_code}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/ustoz" className="text-sm font-bold text-mute hover:text-ink">← Guruhlar</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{group.name}</h1>
        <p className="text-mute">{members.length} o&apos;quvchi{group.grants_premium && " · a'zolar Premium oladi"}</p>
        {sp.xato && <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{String(sp.xato)}</p>}
      </div>

      <section className="card space-y-2">
        <h2 className="font-extrabold">Taklif havolasi</h2>
        <p className="text-sm text-mute">O&apos;quvchi havolani ochib, kirib, bir bosishda guruhga qo&apos;shiladi.</p>
        <CopyLink url={invite} />
        <form action={regenerateInvite} className="pt-1">
          <input type="hidden" name="group" value={group.id} />
          <button className="text-xs font-bold text-mute hover:text-no">
            Havolani yangilash (eski havola ishlamay qoladi — begona qo&apos;lga tushgan bo&apos;lsa)
          </button>
        </form>
      </section>

      <section className="card overflow-x-auto p-0!">
        <h2 className="px-5 pt-4 font-extrabold">O&apos;quvchilar</h2>
        {members.length === 0 ? (
          <p className="px-5 pt-2 pb-4 text-sm text-mute">Hali hech kim qo&apos;shilmagan — havolani yuboring.</p>
        ) : (
          <table className="mt-2 w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-2.5">O&apos;quvchi</th>
                <th className="px-3 py-2.5">7 kun</th>
                <th className="px-3 py-2.5">Umumiy</th>
                <th className="px-3 py-2.5">Streak</th>
                <th className="px-3 py-2.5">Sinov</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const p7 = pct(m.correct_7d, m.answered_7d);
                const pt = pct(m.correct_total, m.answered_total);
                return (
                  <tr key={m.user_id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3">
                      <span className="font-bold">{m.full_name || "Ismsiz"}</span>
                      {m.telegram_username && <span className="block text-xs text-mute">@{m.telegram_username}</span>}
                    </td>
                    <td className="px-3 py-3 tabular-nums">{m.answered_7d} <span className={tone(p7)}>{p7 != null && `· ${p7}%`}</span></td>
                    <td className="px-3 py-3 tabular-nums">{m.answered_total} <span className={tone(pt)}>{pt != null && `· ${pt}%`}</span></td>
                    <td className="px-3 py-3 tabular-nums">🔥 {m.streak_days}</td>
                    <td className="px-3 py-3 font-bold">{m.last_mock_grade ? `${m.last_mock_grade} · ${Number(m.last_mock_scaled)}` : "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <form action={removeMember}>
                        <input type="hidden" name="group" value={group.id} />
                        <input type="hidden" name="user" value={m.user_id} />
                        <button className="text-xs font-bold text-mute hover:text-no" aria-label={`${m.full_name} ni guruhdan chiqarish`}>Chiqarish</button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2 className="font-extrabold">Guruhning zaif mavzulari <span className="text-sm font-semibold text-mute">(30 kun)</span></h2>
        {weakRows.length === 0 ? (
          <p className="mt-2 text-sm text-mute">Hali yetarli ma&apos;lumot yo&apos;q (hujjat bo&apos;yicha kamida 10 ta javob kerak).</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {weakRows.slice(0, 8).map((w) => {
              const p = pct(w.correct, w.answered) ?? 0;
              return (
                <li key={w.document_number}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate font-semibold">№{w.document_number} {w.title}</span>
                    <span className={`shrink-0 font-bold tabular-nums ${tone(p)}`}>{p}% · {w.answered} javob · {w.students} o&apos;q.</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                    <div className={`h-full ${p >= 70 ? "bg-ok" : p >= 50 ? "bg-amber" : "bg-no"}`} style={{ width: `${p}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="card space-y-4">
        <h2 className="font-extrabold">Vazifalar</h2>
        <form action={createAssignment} className="grid gap-3 rounded-xl bg-bg p-4 sm:grid-cols-2">
          <input type="hidden" name="group" value={group.id} />
          <label className="text-sm font-bold sm:col-span-2">
            Nomi
            <input name="title" required maxLength={100} placeholder="Masalan: Saylov kodeksi — takrorlash"
              className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-cyan" />
          </label>
          <label className="text-sm font-bold sm:col-span-2">
            Mavzu
            <select name="topic" required defaultValue="" className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-cyan">
              <option value="" disabled>Tanlang…</option>
              {modules.map((m) => (
                <optgroup key={m.id} label={m.title}>
                  <option value={m.slug}>{m.title} — aralash</option>
                  {(topics ?? []).filter((t) => t.parent_id === m.id).map((t) => (
                    <option key={t.slug} value={t.slug}>{t.title}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold">
            Savollar soni
            <input name="count" type="number" min={5} max={50} defaultValue={15}
              className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-cyan" />
          </label>
          <label className="text-sm font-bold">
            Muddat (ixtiyoriy)
            <input name="due" type="date" className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-cyan" />
          </label>
          <button className="btn-primary sm:col-span-2">Vazifa berish</button>
        </form>

        {(assignments ?? []).length > 0 && (
          <ul className="divide-y divide-line">
            {assignments!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/app/ustoz/${group.id}/vazifa/${a.id}`} className="min-w-0 flex-1 hover:text-cyan-2">
                  <span className="block font-bold">{a.title}</span>
                  <span className="text-sm text-mute">
                    {a.topics?.title} · {a.question_count} savol{a.due_at && ` · muddat ${fmtDate(a.due_at)}`}
                  </span>
                </Link>
                <span className="text-sm font-bold tabular-nums">{doneBy.get(a.id) ?? 0}/{members.length} bajardi</span>
                <form action={deleteAssignment}>
                  <input type="hidden" name="id" value={a.id} />
                  <input type="hidden" name="group" value={group.id} />
                  <button className="text-xs font-bold text-mute hover:text-no">O&apos;chirish</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
