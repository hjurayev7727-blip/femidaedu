import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ReviewList, type ReviewAnswer } from "@/components/question/review-list";
import { requireUser } from "@/lib/auth";
import { finalizeIfEnded } from "@/lib/contest-server";
import { fmtWhen, serverNow } from "@/lib/dates";
import { localizeQuestion, QUESTION_COLUMNS, scriptOf } from "@/lib/practice";
import type { ClientQuestion, Response } from "@/lib/questions";
import { MockRunner } from "../../imtihon/[id]/mock-runner";
import { finishContest, joinContest, saveContestAnswer } from "../actions";

export const metadata: Metadata = { title: "Musobaqa" };

type Contest = { id: number; title: string; starts_at: string; ends_at: string; is_premium: boolean; finalized: boolean };
type Result = { rank: number; name: string; correct: number; total: number; duration_sec: number | null; is_me: boolean };

const ERR: Record<string, string> = {
  premium: "Bu musobaqa Premium foydalanuvchilar uchun.",
  not_started: "Musobaqa hali boshlanmagan.",
  ended: "Musobaqa tugagan.",
};
const mmss = (s: number | null) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);

export default async function ContestPage({ params, searchParams }: PageProps<"/app/musobaqa/[id]">) {
  const { id: raw } = await params;
  const id = z.coerce.number().int().positive().safeParse(raw);
  if (!id.success) notFound();
  const { supabase, userId, profile } = await requireUser();
  const sp = await searchParams;

  const { data: c } = await supabase.from("contests").select("id, title, starts_at, ends_at, is_premium, finalized").eq("id", id.data).maybeSingle<Contest>();
  if (!c) notFound();
  const now = serverNow();
  const started = Date.parse(c.starts_at) <= now;
  const ended = Date.parse(c.ends_at) <= now;

  if (ended && !c.finalized) await finalizeIfEnded(c.id);

  const [{ data: entry }, { data: count }] = await Promise.all([
    supabase.from("contest_entries").select("attempt_id, rank, correct, attempts(finished_at, question_ids)").eq("contest_id", c.id).eq("user_id", userId)
      .maybeSingle<{ attempt_id: string; rank: number | null; correct: number | null; attempts: { finished_at: string | null; question_ids: number[] } | null }>(),
    supabase.rpc("contest_participants", { p_contest: c.id }),
  ]);

  // Jarayonda: savollar (javobsiz) va saqlangan javoblar
  if (started && !ended && entry && !entry.attempts?.finished_at) {
    const ids = (entry.attempts?.question_ids ?? []).map(Number);
    const [{ data: rows }, { data: saved }] = await Promise.all([
      supabase.from("questions").select(QUESTION_COLUMNS).in("id", ids).returns<ClientQuestion[]>(),
      supabase.from("attempt_answers").select("question_id, response").eq("attempt_id", entry.attempt_id).returns<{ question_id: number; response: Response }[]>(),
    ]);
    const byId = new Map((rows ?? []).map((q) => [Number(q.id), q]));
    const items = ids.flatMap((qid, i) => {
      const q = byId.get(qid);
      return q ? [{ label: String(i + 1), question: localizeQuestion({ ...q, id: Number(q.id) }, scriptOf(profile)) }] : [];
    });
    return (
      <MockRunner
        attemptId={entry.attempt_id}
        title={c.title}
        deadlineMs={Date.parse(c.ends_at)}
        serverNowMs={now}
        items={items}
        saved={Object.fromEntries((saved ?? []).map((s) => [Number(s.question_id), s.response]))}
        saveAction={saveContestAnswer}
        finishAction={finishContest}
        hint="Natija va to'g'ri javoblar musobaqa tugagach ochiladi"
      />
    );
  }

  const results = ended ? (((await supabase.rpc("contest_results", { p_contest: c.id })).data ?? []) as Result[]) : [];
  const answers = ended && entry
    ? ((await supabase.from("attempt_answers").select("question_id, response, is_correct").eq("attempt_id", entry.attempt_id).returns<ReviewAnswer[]>()).data ?? [])
    : [];
  // Javoblar faqat tugagan musobaqada ochiladi (ReviewList to'g'ri javoblarni admin klient bilan o'qiydi)
  const reviewIds = ended && entry?.attempts ? entry.attempts.question_ids.map(Number) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link href="/app/musobaqa" className="text-sm font-bold text-mute hover:text-ink">← Musobaqalar</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{c.title}</h1>
        <p className="text-mute">
          {fmtWhen(c.starts_at)} — {fmtWhen(c.ends_at)} · {Number(count ?? 0)} ishtirokchi{c.is_premium && " · Premium"}
        </p>
        {sp.xato && <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{ERR[String(sp.xato)] ?? "Qatnashib bo'lmadi."}</p>}
      </div>

      {!started && <p className="card">Musobaqa <b>{fmtWhen(c.starts_at)}</b> da boshlanadi. Bot eslatma yuboradi.</p>}

      {started && !ended && !entry && (
        <form action={joinContest} className="card text-center">
          <input type="hidden" name="id" value={c.id} />
          <p className="mb-4 text-mute">Boshlaganingizdan so&apos;ng taymer musobaqa tugaguncha ishlaydi. Tezroq yakunlagan yuqoriroq turadi (teng ballda).</p>
          <button className="btn-primary">Qatnashish</button>
        </form>
      )}

      {started && !ended && entry?.attempts?.finished_at && (
        <p className="card">Javoblaringiz qabul qilindi ✓ Natijalar <b>{fmtWhen(c.ends_at)}</b> da e&apos;lon qilinadi.</p>
      )}

      {ended && (
        <section className="card overflow-hidden p-0!">
          <h2 className="px-5 pt-4 font-extrabold">Natijalar</h2>
          {results.length === 0 ? (
            <p className="px-5 py-4 text-sm text-mute">Ishtirokchi bo&apos;lmadi.</p>
          ) : (
            <ol className="mt-2 divide-y divide-line">
              {results.map((r) => (
                <li key={`${r.rank}-${r.name}`} className={`flex items-center gap-3 px-5 py-2.5 ${r.is_me ? "bg-cyan-soft" : ""}`}>
                  <span className="w-8 font-extrabold tabular-nums">{r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}</span>
                  <span className="flex-1 font-semibold">{r.name}{r.is_me && " (siz)"}</span>
                  <span className="font-bold tabular-nums">{r.correct ?? 0}/{r.total}</span>
                  <span className="w-12 text-right text-sm text-mute tabular-nums">{mmss(r.duration_sec)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {ended && reviewIds.length > 0 && (
        <details className="card">
          <summary className="cursor-pointer font-extrabold">Mening javoblarim</summary>
          <div className="mt-4">
            <ReviewList ids={reviewIds} answers={answers} script={scriptOf(profile)} />
          </div>
        </details>
      )}
    </div>
  );
}
