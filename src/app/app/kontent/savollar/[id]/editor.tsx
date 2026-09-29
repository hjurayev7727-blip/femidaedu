"use client";
import { useActionState, useMemo, useState } from "react";
import { longestOptionBias } from "@/lib/bias";
import { saveQuestion } from "../actions";

export type EditableQuestion = {
  id: number;
  version: number;
  type: string;
  stem: string;
  context: string | null;
  options: string[] | null;
  statements: string[] | null;
  correct: number | null;
  kind: string | null;
  accepted: string[] | null;
  show: string | null;
  explanation: string | null;
  source_note: string | null;
  difficulty: number;
  status: string;
  readonlyStructure: string | null;
};

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-cyan";

export function QuestionEditor({ q }: { q: EditableQuestion }) {
  const [state, action, pending] = useActionState(saveQuestion, null);
  const [options, setOptions] = useState(q.options ?? []);
  const [correct, setCorrect] = useState(q.correct ?? 0);
  const bias = useMemo(() => (options.length === 4 ? longestOptionBias(options, correct) : null), [options, correct]);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="id" value={q.id} />
      <input type="hidden" name="version" value={q.version} />
      <input type="hidden" name="type" value={q.type} />

      {q.type === "case" && (
        <label className="block text-sm font-bold">Amaliy vaziyat
          <textarea name="context" defaultValue={q.context ?? ""} rows={3} className={field} />
        </label>
      )}
      <label className="block text-sm font-bold">Savol
        <textarea name="stem" defaultValue={q.stem} rows={2} required className={field} />
      </label>

      {q.statements && (
        <ol className="rounded-xl bg-bg px-4 py-3 text-sm">
          {q.statements.map((s, i) => <li key={i}>{i + 1}. {s}</li>)}
        </ol>
      )}

      {q.options && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Variantlar (to&apos;g&apos;risini belgilang)</legend>
          {options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="radio" name="correct" value={i} checked={correct === i} onChange={() => setCorrect(i)} aria-label={`${String.fromCharCode(65 + i)} — to'g'ri`} className="accent-cyan-600" />
              <span className="w-5 font-extrabold">{String.fromCharCode(65 + i)}</span>
              <input name="options" value={o} onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
                className={`${field} mt-0 ${correct === i ? "border-ok" : ""}`} />
              <span className="w-10 text-right text-xs text-mute tabular-nums">{o.trim().length}</span>
            </div>
          ))}
          {bias?.biased ? (
            <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm">
              ⚠ To&apos;g&apos;ri javob boshqalardan {bias.ratio.toFixed(1)} barobar uzun — o&apos;quvchi bilmasdan topishi mumkin.
              Chalg&apos;ituvchi variantlarni ham shunday batafsil yozing.
            </p>
          ) : (
            <p className="text-xs text-ok">✓ Variantlar uzunligi muvozanatli</p>
          )}
        </fieldset>
      )}

      {q.kind && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-bold">Javob turi
            <select name="kind" defaultValue={q.kind} className={field}>
              <option value="number">Son</option>
              <option value="article">Modda raqami</option>
              <option value="text">Matn</option>
            </select>
          </label>
          <label className="text-sm font-bold">Ko&apos;rsatiladigan javob
            <input name="show" defaultValue={q.show ?? ""} className={field} />
          </label>
          <label className="text-sm font-bold sm:col-span-2">Qabul qilinadigan javoblar (har biri yangi qatorda)
            <textarea name="accepted" defaultValue={(q.accepted ?? []).join("\n")} rows={3} className={field} />
          </label>
        </div>
      )}

      {q.readonlyStructure && <p className="rounded-xl bg-bg px-4 py-3 text-sm text-mute">{q.readonlyStructure}</p>}

      <label className="block text-sm font-bold">Izoh
        <textarea name="explanation" defaultValue={q.explanation ?? ""} rows={3} className={field} />
      </label>
      <label className="block text-sm font-bold">Manba (javobdan keyin ko&apos;rsatiladi)
        <input name="source_note" defaultValue={q.source_note ?? ""} className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold">Qiyinlik
          <select name="difficulty" defaultValue={q.difficulty} className={field}>
            <option value={1}>1 — oson</option>
            <option value={2}>2 — o&apos;rta</option>
            <option value={3}>3 — qiyin</option>
          </select>
        </label>
        <label className="text-sm font-bold">Holat
          <select name="status" defaultValue={q.status} className={field}>
            <option value="published">E&apos;lon qilingan</option>
            <option value="review">Ko&apos;rib chiqilmoqda (yashirin)</option>
            <option value="draft">Qoralama</option>
            <option value="archived">Arxiv</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda…" : "Saqlash"}</button>
        {state && <span role="status" className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
