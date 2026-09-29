"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { initialResponse, isComplete, QuestionView } from "@/components/question/question-view";
import type { ClientQuestion, Response } from "@/lib/questions";
import { finishMockExam, saveAnswer } from "../actions";

export type MockItem = { label: string; question: ClientQuestion };

type SaveState = "saving" | "saved" | "error";

type Props = {
  attemptId: string;
  title: string;
  deadlineMs: number;
  serverNowMs: number;
  items: MockItem[];
  saved: Record<number, Response>;
  /** faqat /dev sahifasi uchun: serverga murojaat qilinmaydi */
  demo?: boolean;
  /** musobaqa kabi boshqa rejimlar uchun o'z server action'lari (standart — sinov imtihoni) */
  saveAction?: (attemptId: string, questionId: number, response: unknown) => Promise<{ ok: boolean; reason?: string }>;
  finishAction?: (attemptId: string) => Promise<void>;
  /** navigator izohi */
  hint?: string;
};

const SAVE_DELAY = 600;

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function MockRunner({
  attemptId, title, deadlineMs, serverNowMs, items, saved, demo = false,
  saveAction = saveAnswer, finishAction = finishMockExam, hint = "1–35 — yopiq, 36–45 — yozma (a, b qismlar)",
}: Props) {
  const [pos, setPos] = useState(0);
  const [responses, setResponses] = useState<Record<number, Response>>(saved);
  const [status, setStatus] = useState<Record<number, SaveState>>(() =>
    Object.fromEntries(Object.keys(saved).map((k) => [k, "saved" as SaveState])),
  );
  const [left, setLeft] = useState(() => deadlineMs - serverNowMs);
  const [confirming, setConfirming] = useState(false);
  const [finishing, startFinish] = useTransition();
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const finishedRef = useRef(false);
  const offset = useRef(0);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    if (demo) return void alert("DEV: sinov yakunlandi (baholash serverda bo'ladi)");
    // kutilayotgan saqlashlarni kutmasdan yakunlaymiz: server bazadagi so'nggi javoblarni baholaydi
    startFinish(() => finishAction(attemptId));
  }, [attemptId, demo, finishAction]);

  // Taymer — server vaqtiga moslangan (foydalanuvchi soatini o'zgartirsa ham to'g'ri)
  useEffect(() => {
    offset.current = serverNowMs - Date.now();
    const tick = () => {
      const l = deadlineMs - (Date.now() + offset.current);
      setLeft(l);
      if (l <= 0) finish();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadlineMs, serverNowMs, finish]);

  const persist = useCallback(
    async (qid: number, r: Response) => {
      setStatus((s) => ({ ...s, [qid]: "saving" }));
      try {
        const res = demo ? { ok: true, reason: undefined } : await saveAction(attemptId, qid, r);
        if (res.ok) setStatus((s) => ({ ...s, [qid]: "saved" }));
        else if (res.reason === "expired" || res.reason === "finished") finish();
        else setStatus((s) => ({ ...s, [qid]: "error" }));
      } catch {
        setStatus((s) => ({ ...s, [qid]: "error" }));
      }
    },
    [attemptId, finish, demo, saveAction],
  );

  function change(qid: number, r: Response) {
    setResponses((prev) => ({ ...prev, [qid]: r }));
    const old = timers.current.get(qid);
    if (old) clearTimeout(old);
    const q = items.find((x) => x.question.id === qid)!.question;
    if (!isComplete(q, r)) return;
    setStatus((s) => ({ ...s, [qid]: "saving" }));
    timers.current.set(qid, setTimeout(() => persist(qid, r), SAVE_DELAY));
  }

  const item = items[pos];
  const answeredCount = items.filter((it) => isComplete(it.question, responses[it.question.id] ?? null)).length;
  const unsaved = Object.values(status).some((s) => s === "saving" || s === "error");
  const warn = left < 5 * 60_000;
  const current = responses[item.question.id] ?? initialResponse(item.question);
  const st = status[item.question.id];

  return (
    <div className="mx-auto max-w-5xl">
      {/* Yuqori panel: nom, taymer, yakunlash */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold">{title}</p>
          <p className="text-xs text-mute">{answeredCount} / {items.length} javob berildi</p>
        </div>
        <div className="flex items-center gap-3">
          <span role="timer" aria-live="off" className={`whitespace-nowrap rounded-xl px-3 py-1.5 font-extrabold tabular-nums ${warn ? "bg-no-soft text-no" : "bg-card text-ink"}`}>
            ⏱ {fmt(left)}
          </span>
          <button type="button" className="btn-primary px-4! py-2! text-sm!" onClick={() => setConfirming(true)} disabled={finishing}>
            Yakunlash
          </button>
        </div>
      </div>

      {confirming && (
        <div role="alertdialog" aria-labelledby="fin-t" className="card mb-4 border-2 border-amber">
          <p id="fin-t" className="font-extrabold">Sinovni yakunlaysizmi?</p>
          <p className="mt-1 text-sm text-mute">
            {items.length - answeredCount > 0
              ? `${items.length - answeredCount} ta topshiriqqa javob berilmagan — ular 0 ball.`
              : "Barcha topshiriqlarga javob berildi."}
            {unsaved && " Ba'zi javoblar hali saqlanmoqda — bir soniya kuting."}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" disabled={finishing || unsaved} onClick={finish}>
              {finishing ? "Baholanmoqda…" : "Ha, yakunlash"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>Davom etish</button>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="card">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-extrabold">{item.label}-topshiriq</span>
            <span className="text-xs text-mute" aria-live="polite">
              {st === "saving" ? "Saqlanmoqda…" : st === "saved" ? "✓ Saqlandi" : st === "error" ? "⚠ Saqlanmadi — qayta urinib ko'ring" : ""}
            </span>
          </div>
          <QuestionView
            question={item.question}
            response={current}
            onChange={(r) => change(item.question.id, r)}
            reveal={null}
            disabled={finishing}
          />
          {st === "error" && (
            <button type="button" className="btn-ghost mt-3 text-sm!" onClick={() => persist(item.question.id, current!)}>
              Qayta saqlash
            </button>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <button type="button" className="btn-ghost" disabled={pos === 0} onClick={() => setPos(pos - 1)}>← Oldingi</button>
            <button type="button" className="btn-ghost" disabled={pos === items.length - 1} onClick={() => setPos(pos + 1)}>Keyingi →</button>
          </div>
        </div>

        <nav aria-label="Topshiriqlar" className="card h-fit">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-mute">Topshiriqlar</p>
          <div className="grid grid-cols-7 gap-1.5 lg:grid-cols-5">
            {items.map((it, i) => {
              const done = isComplete(it.question, responses[it.question.id] ?? null);
              return (
                <button
                  key={it.question.id}
                  type="button"
                  onClick={() => setPos(i)}
                  aria-current={i === pos ? "step" : undefined}
                  aria-label={`${it.label}-topshiriq${done ? ", javob berilgan" : ""}`}
                  className={`h-9 rounded-lg text-xs font-extrabold tabular-nums transition
                    ${i === pos ? "ring-2 ring-cyan ring-offset-2 ring-offset-card" : ""}
                    ${done ? "bg-cyan-2 text-white" : "bg-bg text-mute hover:bg-cyan-soft"}`}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-mute">{hint}</p>
        </nav>
      </div>
    </div>
  );
}
