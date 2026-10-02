"use client";
import { useState, useTransition } from "react";
import { initialResponse, isComplete, QuestionView } from "@/components/question/question-view";
import type { LiveResult } from "@/lib/live-server";
import type { LiveState } from "@/lib/live";
import type { ClientQuestion, Response } from "@/lib/questions";
import { Leaderboard } from "./leaderboard";
import { useLive } from "./use-live";

/** O'quvchi ekrani: kutish → savol (taymer) → natija va top-5 → yakun */
export function LivePlayer(props: {
  roomId: string;
  initial: LiveState;
  answer: (roomId: string, itemId: number, response: unknown) => Promise<LiveResult<null>>;
  /** dev namunasi: so'rov yuborilmaydi */
  demo?: boolean;
}) {
  const { state: s, left, lost, refresh } = useLive(props.demo ? null : `/api/jonli/${props.roomId}`, props.initial);
  const [response, setResponse] = useState<Response | null>(() =>
    props.initial.item ? initialResponse({ ...props.initial.item, id: Number(props.initial.item.id) }) : null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const item = s.item;
  const question: ClientQuestion | null = item ? { ...item, id: Number(item.id) } : null;

  // Yangi savol — javob holati tozalanadi (render paytida, oldingi savol id'si bilan solishtirib)
  const [forItem, setForItem] = useState(item?.id ?? null);
  if (forItem !== (item?.id ?? null)) {
    setForItem(item?.id ?? null);
    setResponse(question ? initialResponse(question) : null);
    setSent(false);
    setError(null);
  }

  function submit(r: Response | null = response) {
    if (!question || !r || !isComplete(question, r) || pending) return;
    setError(null);
    start(async () => {
      const res = await props.answer(props.roomId, question.id, r);
      if (res.ok) setSent(true);
      else setError(res.message);
      await refresh();
    });
  }

  if (lost === "not_joined") return <p className="card text-center font-semibold">Siz bu xonada emassiz. PIN orqali qayta qo&apos;shiling.</p>;
  const me = s.me;
  const answered = sent || Boolean(me?.answered);
  const choice = question && "options" in question.payload && ["single", "fill_blank", "case"].includes(question.type);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between gap-3 text-sm font-bold">
        <span className="truncate">{s.title}</span>
        <span className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-white">{me?.name} · {me?.score ?? 0}</span>
      </div>

      {s.status === "lobby" && (
        <div className="card space-y-3 py-10 text-center">
          <p className="text-5xl" aria-hidden>⏳</p>
          <h1 className="text-2xl font-bold">Siz qo&apos;shildingiz!</h1>
          <p className="text-mute">O&apos;qituvchi boshlashini kuting · {s.players} ishtirokchi</p>
        </div>
      )}

      {s.status === "question" && question && (
        <div className="card space-y-4">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-mute">{s.pos + 1} / {s.total}</span>
            <span className={`rounded-lg px-3 py-1 font-mono text-lg tabular-nums ${left <= 5 ? "bg-no-soft text-no" : "bg-brand-soft text-brand-2"}`} role="timer">{left}</span>
          </div>
          {answered ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-4xl" aria-hidden>✅</p>
              <p className="text-lg font-bold">Javob qabul qilindi</p>
              <p className="text-sm text-mute">Natija vaqt tugagach ko&apos;rsatiladi</p>
            </div>
          ) : (
            <>
              <QuestionView question={question} response={response}
                onChange={(r) => { setResponse(r); if (choice) submit(r); }}
                reveal={null} disabled={pending || left === 0} />
              {!choice && (
                <button type="button" onClick={() => submit()} disabled={pending || !isComplete(question, response) || left === 0} className="btn-primary w-full">
                  {pending ? "Yuborilmoqda…" : "Javob berish"}
                </button>
              )}
            </>
          )}
          {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
        </div>
      )}

      {s.status === "reveal" && (
        <div className="space-y-4">
          <div className={`card py-6 text-center ${me?.last?.correct ? "!border-ok" : "!border-no"}`}>
            <p className="text-4xl" aria-hidden>{me?.last ? (me.last.correct ? "🎉" : "😕") : "⌛"}</p>
            <p className={`mt-2 text-2xl font-bold ${me?.last?.correct ? "text-ok" : "text-no"}`}>
              {me?.last ? (me.last.correct ? `To'g'ri! +${me.last.points}` : "Xato") : "Javob berilmadi"}
            </p>
            <p className="mt-1 font-semibold text-mute">{me?.rank}-o&apos;rin · {me?.score} ball</p>
          </div>
          {question && s.answer && (
            <div className="card">
              <QuestionView question={question} response={response} onChange={() => {}} reveal={s.answer} disabled />
              {s.explanation && <p className="mt-3 rounded-r-xl border-l-4 border-brand bg-brand-soft px-4 py-3 text-sm">{s.explanation}</p>}
            </div>
          )}
          <div className="card"><h2 className="mb-3 text-lg font-bold">Top-5</h2><Leaderboard top={s.top ?? []} highlight={me?.name} /></div>
        </div>
      )}

      {s.status === "finished" && (
        <div className="space-y-4">
          <div className="bg-hero rounded-[22px] p-6 text-center text-white">
            <p className="text-5xl" aria-hidden>{(me?.rank ?? 99) <= 3 ? ["🥇", "🥈", "🥉"][(me?.rank ?? 1) - 1] : "🏁"}</p>
            <p className="mt-2 font-display text-4xl font-bold">{me?.rank}-o&apos;rin</p>
            <p className="mt-1 text-slate-300">{me?.score} ball · {me?.correct}/{s.total} to&apos;g&apos;ri</p>
          </div>
          <div className="card"><h2 className="mb-3 text-lg font-bold">G&apos;oliblar</h2><Leaderboard top={s.top ?? []} highlight={me?.name} /></div>
        </div>
      )}
    </div>
  );
}
