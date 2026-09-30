"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { askAiExplain, askAiRegrade } from "../../actions";

type Props = {
  attemptId: string;
  questionId: number;
  /** yozma matnli javob xato deb baholangan — AI qayta tekshiruvi mumkin */
  canRegrade: boolean;
  premium: boolean;
  enabled: boolean;
  onRegraded: (correct: boolean) => void;
};

export function AiPanel({ attemptId, questionId, canRegrade, premium, enabled, onRegraded }: Props) {
  const [pending, start] = useTransition();
  const [regrade, setRegrade] = useState<{ ok: boolean; text: string; correct?: boolean } | null>(null);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ ok: boolean; text: string } | null>(null);

  if (!enabled) return null;
  if (!premium) {
    return (
      <p className="rounded-xl bg-bg px-4 py-3 text-sm">
        🤖 <b>AI ustoz</b> — tushunmagan savolingizni so&apos;rang, yozma javobingizni qayta tekshirtiring.{" "}
        <Link href="/app/premium" className="font-bold text-brand-2 underline-offset-2 hover:underline">Premium</Link>
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-xl bg-bg p-3">
      <div className="flex flex-wrap gap-2">
        {canRegrade && !regrade && (
          <button
            type="button"
            disabled={pending}
            className="btn-ghost px-3! py-2! text-sm!"
            onClick={() =>
              start(async () => {
                const r = await askAiRegrade(attemptId, questionId);
                if (r.ok) {
                  setRegrade({ ok: true, text: r.value.comment, correct: r.value.correct });
                  if (r.value.correct) onRegraded(true);
                } else setRegrade({ ok: false, text: r.message });
              })
            }
          >
            🤖 AI qayta tekshirsin
          </button>
        )}
        {!asking && !answer && (
          <button type="button" className="btn-ghost px-3! py-2! text-sm!" onClick={() => setAsking(true)}>
            🤖 AI&apos;dan so&apos;rash
          </button>
        )}
      </div>

      {regrade && (
        <p role="status" className={`text-sm ${regrade.ok ? (regrade.correct ? "text-ok" : "text-ink") : "text-no"}`}>
          {regrade.ok && <b>{regrade.correct ? "AI: javobingiz mazmunan to'g'ri ✓ " : "AI: javob qabul qilinmadi. "}</b>}
          {regrade.text}
        </p>
      )}

      {asking && !answer && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await askAiExplain(attemptId, questionId, question);
              setAnswer(r.ok ? { ok: true, text: r.value } : { ok: false, text: r.message });
            });
          }}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Nimani tushunmadingiz? (bo'sh qoldirsangiz — nega shu javob to'g'riligini tushuntiradi)"
            className="w-full rounded-xl border-2 border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <button disabled={pending} className="btn-primary px-4! py-2! text-sm!">{pending ? "AI o'ylamoqda…" : "So'rash"}</button>
        </form>
      )}

      {answer && (
        <div role="status" className={`whitespace-pre-line rounded-xl border-l-4 px-4 py-3 text-[15px] leading-relaxed ${answer.ok ? "border-brand bg-card" : "border-no bg-no-soft text-no"}`}>
          {answer.ok && <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-brand-2">AI ustoz</p>}
          {answer.text}
        </div>
      )}
    </div>
  );
}
