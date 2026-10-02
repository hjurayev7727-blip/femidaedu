import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { fmtUz } from "@/lib/dates";
import { describeAnswer, describeResponse } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { canReveal, REVEAL_LABEL } from "@/lib/user-tests";
import { currentActor, loadAttempt } from "@/lib/user-tests-server";
import { rateTest } from "../../../actions";

export const metadata: Metadata = { title: "Natija", robots: { index: false } };

const dt = (iso: string) => fmtUz(iso);

export default async function TestResultPage({ params }: PageProps<"/t/[kod]/[urinish]/natija">) {
  const { kod, urinish } = await params;
  if (!z.uuid().safeParse(urinish).success) notFound();
  const actor = await currentActor();
  const loaded = await loadAttempt(urinish, actor);
  if (!loaded || loaded.test.code !== kod.toUpperCase()) notFound();
  const { test, attempt, items, answers } = loaded;
  if (!attempt.finishedAt) redirect(`/t/${test.code}/${attempt.id}`);

  const reveal = canReveal(test.reveal, { finished: true, closesAt: test.closesAt });
  const score = Math.round(attempt.score ?? 0);
  const { data: rating } = actor.userId
    ? await createSupabaseAdmin().from("test_ratings").select("stars").eq("test_id", test.id).eq("user_id", actor.userId).maybeSingle<{ stars: number }>()
    : { data: null };
  const back = `/t/${test.code}/${attempt.id}/natija`;
  const isOwner = actor.userId === test.ownerId;

  return (
    <div className="space-y-5">
      <section className="bg-hero rounded-[22px] p-6 text-center text-white">
        <p className="text-sm font-bold text-gold-2">{test.title}</p>
        <p className="mt-2 font-display text-6xl font-bold">{score}%</p>
        <p className="mt-1 text-slate-300">{attempt.correct ?? 0} / {attempt.total ?? items.length} to&apos;g&apos;ri</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href={`/t/${test.code}`} className="btn border-2 border-white/20 text-white">Test sahifasi</Link>
          <Link href="/app/testlar/yangi" className="btn-primary">🤖 O&apos;zim test yarataman</Link>
        </div>
      </section>

      {!actor.userId && (
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Natijani saqlash, xatolar ustida ishlash va o&apos;z testingizni yaratish uchun kiring.</p>
          <Link href={`/kirish?keyin=${encodeURIComponent(back)}`} className="btn-primary">Telegram bilan kirish</Link>
        </div>
      )}

      {actor.userId && !isOwner && (
        <form action={rateTest} className="card flex flex-wrap items-center gap-3">
          <input type="hidden" name="test" value={test.id} />
          <input type="hidden" name="back" value={back} />
          <span className="font-bold">Testni baholang:</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} name="stars" value={n} aria-label={`${n} yulduz`}
                className={`text-2xl transition-transform hover:scale-110 ${rating && n <= rating.stars ? "text-gold" : "text-line"}`}>★</button>
            ))}
          </div>
          {rating && <span className="text-sm text-mute">Rahmat!</span>}
        </form>
      )}

      {reveal ? (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Tahlil</h2>
          {items.map((q, i) => {
            const a = answers.get(q.id);
            return (
              <article key={q.id} className="card !p-4">
                <p className="text-xs font-bold text-mute">#{i + 1}</p>
                {q.context && <p className="mt-1 text-sm text-mute">{q.context}</p>}
                <p className="mt-1 font-bold">{q.stem}</p>
                <p className={`mt-2 text-sm font-semibold ${a?.is_correct ? "text-ok" : "text-no"}`}>
                  {a?.is_correct ? "✓" : "✕"} Sizning javobingiz: {describeResponse(q.type, q.payload, a?.response ?? null)}
                </p>
                {!a?.is_correct && <p className="text-sm font-semibold text-ok">To&apos;g&apos;ri javob: {describeAnswer(q.type, q.payload, q.answer)}</p>}
                {q.explanation && <p className="mt-2 rounded-r-lg border-l-4 border-brand bg-brand-soft px-3 py-2 text-sm">{q.explanation}</p>}
              </article>
            );
          })}
        </section>
      ) : (
        <p className="card text-center text-sm font-semibold text-mute">
          To&apos;g&apos;ri javoblar {REVEAL_LABEL[test.reveal].toLowerCase()} ko&apos;rsatiladi{test.closesAt ? ` (${dt(test.closesAt)})` : ""}.
        </p>
      )}
    </div>
  );
}
