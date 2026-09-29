"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { initialResponse, isComplete, QuestionView } from "@/components/question/question-view";
import type { SubmitResult } from "@/lib/practice";
import type { ClientQuestion, Response } from "@/lib/questions";
import { answerQuestion, finishPractice, reportQuestion } from "../../actions";
import { AiPanel } from "./ai-panel";

type Props = {
  attemptId: string;
  topicTitle: string;
  questions: ClientQuestion[];
  answeredIds: number[];
  initialCorrect: number;
  premium: boolean;
  aiEnabled: boolean;
};

const REASON_TEXT: Record<string, string> = {
  finished: "Bu mashq allaqachon yakunlangan.",
  duplicate: "Bu savolga javob berilgan.",
  invalid: "Javob noto'g'ri shaklda yuborildi.",
  not_found: "Savol topilmadi.",
  not_in_attempt: "Savol bu mashqqa tegishli emas.",
};

export function PracticeRunner({ attemptId, topicTitle, questions, answeredIds, initialCorrect, premium, aiEnabled }: Props) {
  const [done, setDone] = useState(() => new Set(answeredIds));
  const firstOpen = questions.findIndex((q) => !answeredIds.includes(q.id));
  const [pos, setPos] = useState(firstOpen === -1 ? questions.length - 1 : firstOpen);
  const q = questions[pos];
  const [response, setResponse] = useState<Response | null>(() => (q ? initialResponse(q) : null));
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [correctCount, setCorrectCount] = useState(initialCorrect);
  const [pending, startTransition] = useTransition();
  const shownAt = useRef(0);
  const allDone = done.size >= questions.length;

  useEffect(() => {
    shownAt.current = performance.now();
  }, [pos]);

  function submit() {
    if (!q || !isComplete(q, response) || pending) return;
    const elapsed = performance.now() - shownAt.current;
    startTransition(async () => {
      const r = await answerQuestion(attemptId, q.id, response, elapsed);
      setResult(r);
      if (r.ok) {
        setDone((d) => new Set(d).add(q.id));
        if (r.correct) setCorrectCount((c) => c + 1);
      }
    });
  }

  function next() {
    const n = questions.findIndex((x, i) => i > pos && !done.has(x.id));
    if (n === -1) return startTransition(() => finishPractice(attemptId));
    setPos(n);
    setResponse(initialResponse(questions[n]));
    setResult(null);
  }

  // Klaviatura: 1–4 / A–D — variant, Enter — yuborish / keyingi
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Enter" && e.target instanceof HTMLInputElement) (result?.ok ? next : submit)();
        return;
      }
      if (e.key === "Enter") return (result?.ok ? next : submit)();
      if (result || !("options" in q.payload)) return;
      const i = "1234".indexOf(e.key) >= 0 ? "1234".indexOf(e.key) : "abcd".indexOf(e.key.toLowerCase());
      if (i >= 0 && i < q.payload.options.length) setResponse({ index: i });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!q) return null;
  const locked = pending || Boolean(result?.ok);
  const progress = Math.round((done.size / questions.length) * 100);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <Link href="/app/mashq" className="font-bold text-mute hover:text-ink">← {topicTitle}</Link>
        <span className="font-extrabold tabular-nums">{Math.min(pos + 1, questions.length)} / {questions.length}</span>
      </div>
      <div className="mb-5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <div className="bg-accent h-full transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      <div className="card">
        <QuestionView
          question={q}
          response={response}
          onChange={setResponse}
          reveal={result?.ok ? result.answer : null}
          disabled={locked}
        />

        {result?.ok && (
          <div className="mt-5 space-y-3">
            <p className={`text-lg font-extrabold ${result.correct ? "text-ok" : "text-no"}`}>
              {result.correct ? "To'g'ri! ✓" : result.score > 0 ? `Qisman to'g'ri (${Math.round(result.score * 100)}%)` : "Xato ✕"}
            </p>
            {result.explanation && (
              <p className="rounded-r-xl border-l-4 border-cyan bg-cyan-soft px-4 py-3 text-[15px] leading-relaxed">{result.explanation}</p>
            )}
            {result.sourceNote && <p className="text-[12.5px] text-mute">📖 {result.sourceNote}</p>}
            {result.limit != null && result.usedToday >= result.limit - 3 && (
              <p className="text-sm font-semibold text-amber">
                Bugungi bepul limitdan {result.usedToday}/{result.limit} ishlatildi.
              </p>
            )}
            <AiPanel
              key={q.id}
              attemptId={attemptId}
              questionId={q.id}
              premium={premium}
              enabled={aiEnabled}
              canRegrade={!result.correct && q.type === "open" && (q.payload as { kind?: string }).kind === "text"}
              onRegraded={() => {
                setResult({ ...result, correct: true, score: 1 });
                setCorrectCount((c) => c + 1);
              }}
            />
            <ReportButton questionId={q.id} />
          </div>
        )}

        {result && !result.ok && result.reason === "limit" && <LimitCard onFinish={() => startTransition(() => finishPractice(attemptId))} />}
        {result && !result.ok && result.reason !== "limit" && (
          <p role="alert" className="mt-4 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{REASON_TEXT[result.reason]}</p>
        )}

        {!(result && !result.ok && result.reason === "limit") && (
          <div className="mt-6">
            {result?.ok ? (
              <button type="button" onClick={next} disabled={pending} className="btn-primary w-full">
                {allDone ? (pending ? "Natija hisoblanmoqda…" : "Natijani ko'rish") : "Keyingi savol →"}
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={!isComplete(q, response) || pending} className="btn-primary w-full">
                {pending ? "Tekshirilmoqda…" : "Javobni tekshirish"}
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-mute">
        To&apos;g&apos;ri: {correctCount} · Klaviatura: 1–4 variant, Enter — davom
      </p>
    </div>
  );
}

function LimitCard({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="mt-5 rounded-[14px] border-2 border-amber bg-amber-soft p-4">
      <p className="font-extrabold">Bugungi bepul limit tugadi 🙌</p>
      <p className="mt-1 text-sm">
        Bepul tarifda kuniga 20 ta savol. Ertaga davom eting yoki Premium bilan cheksiz mashq qiling.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onFinish} className="btn-ghost">Natijani ko&apos;rish</button>
        <Link href="/app/premium" className="btn-primary">Premium haqida</Link>
      </div>
    </div>
  );
}

function ReportButton({ questionId }: { questionId: number }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();

  if (status?.ok) return <p className="text-xs font-semibold text-ok">{status.message}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-xs font-bold text-mute underline-offset-2 hover:underline">
        ⚑ Savolda xato bormi?
      </button>
    );
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setStatus(await reportQuestion(questionId, msg)));
      }}
    >
      <textarea
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Nima noto'g'ri? (masalan: javob eskirgan, modda o'zgargan)"
        className="w-full rounded-xl border-2 border-line bg-card px-3 py-2 text-sm outline-none focus:border-cyan"
      />
      <div className="flex items-center gap-2">
        <button disabled={pending || msg.trim().length < 3} className="btn-ghost px-3! py-2! text-sm!">Yuborish</button>
        {status && !status.ok && <span className="text-xs text-no">{status.message}</span>}
      </div>
    </form>
  );
}
