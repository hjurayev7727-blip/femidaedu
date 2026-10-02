"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { initialResponse, isComplete, QuestionView } from "@/components/question/question-view";
import type { Answer, ClientQuestion, Response } from "@/lib/questions";
import type { Reveal } from "@/lib/user-tests";
import type { TestAnswerResult } from "@/lib/user-tests-server";

type Shown = { correct: boolean; answer: Answer; explanation: string | null };

export type RunnerProps = {
  code: string;
  attemptId: string;
  title: string;
  reveal: Reveal;
  items: ClientQuestion[];
  saved: Record<number, Response>;
  /** reveal = each: allaqachon javob berilganlarning natijasi */
  shown: Record<number, Shown>;
  deadlineMs: number | null;
  serverNowMs: number;
  answer: (attemptId: string, itemId: number, response: unknown) => Promise<TestAnswerResult>;
  finish: (code: string, attemptId: string) => Promise<void>;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Ulashilgan testni ishlash. reveal=each — javob darhol tekshiriladi; aks holda yakunlaguncha o'zgartirish mumkin. */
export function TestRunner(p: RunnerProps) {
  const each = p.reveal === "each";
  const [pos, setPos] = useState(() => {
    const first = p.items.findIndex((q) => !(q.id in p.saved));
    return first === -1 ? 0 : first;
  });
  const [responses, setResponses] = useState<Record<number, Response>>(p.saved);
  const [answered, setAnswered] = useState(() => new Set(Object.keys(p.saved).map(Number)));
  const [shown, setShown] = useState<Record<number, Shown>>(p.shown);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [finishing, startFinish] = useTransition();
  const [left, setLeft] = useState(() => (p.deadlineMs == null ? null : p.deadlineMs - p.serverNowMs));
  const finished = useRef(false);

  const q = p.items[pos];
  const response = q ? responses[q.id] ?? initialResponse(q) : null;
  const done = answered.size;

  function finish() {
    if (finished.current) return;
    finished.current = true;
    startFinish(() => p.finish(p.code, p.attemptId));
  }

  // Taymer server vaqtiga nisbatan (qurilma soati noto'g'ri bo'lsa ham)
  useEffect(() => {
    if (p.deadlineMs == null) return;
    const offset = p.serverNowMs - Date.now();
    const t = setInterval(() => {
      const l = p.deadlineMs! - (Date.now() + offset);
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        finish();
      }
    }, 500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.deadlineMs, p.serverNowMs]);

  function submit() {
    if (!q || !response || !isComplete(q, response) || pending) return;
    const itemId = q.id;
    setError(null);
    start(async () => {
      const r = await p.answer(p.attemptId, itemId, response);
      if (!r.ok) return setError(r.message);
      setAnswered((s) => new Set(s).add(itemId));
      if (r.revealed) setShown((s) => ({ ...s, [itemId]: { correct: r.correct, answer: r.answer, explanation: r.explanation } }));
      else if (pos < p.items.length - 1) setPos(pos + 1);
    });
  }

  if (!q) return null;
  const result = shown[q.id];
  const locked = pending || (each && answered.has(q.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-lg font-bold">{p.title}</h1>
        {left != null && (
          <span className={`shrink-0 rounded-lg px-3 py-1.5 font-mono text-lg font-bold tabular-nums ${left < 60_000 ? "bg-no-soft text-no" : "bg-navy text-white"}`} role="timer" aria-live="off">
            {fmt(left)}
          </span>
        )}
      </div>

      <nav aria-label="Savollar" className="flex flex-wrap gap-1.5">
        {p.items.map((x, i) => {
          const s = shown[x.id];
          const cls = i === pos ? "border-brand bg-brand text-white"
            : s ? (s.correct ? "border-ok bg-ok-soft text-ok" : "border-no bg-no-soft text-no")
            : answered.has(x.id) ? "border-brand/40 bg-brand-soft text-brand-2" : "border-line text-mute";
          return (
            <button key={x.id} type="button" onClick={() => { setPos(i); setError(null); }} aria-current={i === pos}
              className={`h-9 w-9 rounded-lg border-2 text-sm font-bold ${cls}`}>{i + 1}</button>
          );
        })}
      </nav>

      <div className="card">
        <QuestionView
          question={q}
          response={response}
          onChange={(r) => setResponses((s) => ({ ...s, [q.id]: r }))}
          reveal={result ? result.answer : null}
          disabled={locked}
        />
        {result && (
          <div className="mt-4 space-y-2">
            <p className={`text-lg font-extrabold ${result.correct ? "text-ok" : "text-no"}`}>{result.correct ? "To'g'ri! ✓" : "Xato ✕"}</p>
            {result.explanation && <p className="rounded-r-xl border-l-4 border-brand bg-brand-soft px-4 py-3 text-[15px]">{result.explanation}</p>}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-no">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {!(each && answered.has(q.id)) ? (
            <button type="button" onClick={submit} disabled={pending || !isComplete(q, response)} className="btn-primary">
              {pending ? "Saqlanmoqda…" : each ? "Javob berish" : answered.has(q.id) ? "Javobni yangilash" : "Saqlash"}
            </button>
          ) : pos < p.items.length - 1 ? (
            <button type="button" onClick={() => setPos(pos + 1)} className="btn-primary">Keyingi →</button>
          ) : <span />}
          <span className="text-sm font-semibold text-mute">{done}/{p.items.length} javob berildi</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={finishing}
          onClick={() => (done >= p.items.length || confirm(`${p.items.length - done} ta savol javobsiz. Yakunlaysizmi?`)) && finish()}
          className={done >= p.items.length ? "btn-gold" : "btn-ghost"}>
          {finishing ? "Yakunlanmoqda…" : "Testni yakunlash"}
        </button>
      </div>
    </div>
  );
}
