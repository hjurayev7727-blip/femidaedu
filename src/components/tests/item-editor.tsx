"use client";
import { useState, useTransition } from "react";
import type { FormState } from "@/app/app/testlar/actions";
import type { ItemInput } from "@/lib/user-tests";

const LETTERS = "ABCDEFGH";
const TYPE_LABEL: Record<ItemInput["type"], string> = {
  single: "Test", fill_blank: "Bo'sh joy", case: "Vaziyat", multi: "Bir nechta javob", open: "Yozma",
};
const field = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 outline-none focus:border-brand";

export type EditorItem = { id: number; input: ItemInput; article: string | null; stats: { answered: number; correct: number } | null };

const blank: ItemInput = { type: "single", stem: "", context: "", options: ["", "", "", ""], correct: 0, explanation: "", article_id: null, difficulty: 2 };

/** Bitta savol: ko'rish va tahrirlash. Javob kaliti o'zgarsa server natijalarni jimgina qayta hisoblaydi. */
export function ItemEditor(props: {
  testId: number;
  index: number;
  item: EditorItem | null;
  save: (testId: number, itemId: number | null, input: unknown) => Promise<FormState>;
  remove?: (testId: number, itemId: number) => Promise<FormState>;
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState<ItemInput>(props.item?.input ?? blank);
  const [msg, setMsg] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const it = props.item;

  const set = (patch: Partial<ItemInput>) => setV((x) => ({ ...x, ...patch }) as ItemInput);
  const setType = (type: ItemInput["type"]) => {
    const base = { stem: v.stem, explanation: v.explanation, article_id: v.article_id, difficulty: v.difficulty };
    const options = "options" in v ? v.options : ["", "", "", ""];
    if (type === "open") setV({ ...base, type, kind: "text", accepted: [""], show: "" });
    else if (type === "multi") setV({ ...base, type, context: "context" in v ? v.context : "", options, correct_many: [0] });
    else setV({ ...base, type, context: "context" in v ? v.context : "", options, correct: "correct" in v ? v.correct : 0 });
  };

  function submit() {
    start(async () => {
      const r = await props.save(props.testId, it?.id ?? null, v);
      setMsg(r);
      if (r?.ok) {
        setOpen(false);
        if (!it) setV(blank);
      }
    });
  }

  if (!open) {
    if (!it) {
      return (
        <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full border-dashed">+ Savol qo&apos;shish</button>
      );
    }
    const q = it.input;
    const pct = it.stats && it.stats.answered ? Math.round((100 * it.stats.correct) / it.stats.answered) : null;
    return (
      <div className="card !p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="text-mute">#{props.index + 1}</span>
          <span className="tag">{TYPE_LABEL[q.type]}</span>
          {it.article ? <span className="rounded-md bg-gold-soft px-2 py-0.5 text-gold">📖 {it.article}</span>
            : <span className="rounded-md bg-amber-soft px-2 py-0.5 text-amber">Bazaga bog&apos;lanmagan</span>}
          {pct != null && (
            <span className={`rounded-md px-2 py-0.5 ${pct < 25 ? "bg-no-soft text-no" : "bg-line text-mute"}`}>
              {it.stats!.answered} javob · {pct}% to&apos;g&apos;ri{pct < 25 ? " — kalitni tekshiring" : ""}
            </span>
          )}
        </div>
        {"context" in q && q.context && <p className="mt-2 rounded-r-lg border-l-4 border-amber bg-amber-soft px-3 py-2 text-sm">{q.context}</p>}
        <p className="mt-2 font-bold">{q.stem}</p>
        {"options" in q ? (
          <ol className="mt-2 space-y-1 text-sm">
            {q.options.map((o, i) => {
              const right = q.type === "multi" ? q.correct_many.includes(i) : "correct" in q && q.correct === i;
              return (
                <li key={i} className={right ? "font-bold text-ok" : ""}>{LETTERS[i]}) {o}{right && " ✓"}</li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm"><b className="text-ok">Javob:</b> {q.accepted.join(" | ")}</p>
        )}
        {q.explanation && <p className="mt-2 text-sm text-mute">💡 {q.explanation}</p>}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => setOpen(true)} className="rounded-lg px-3 py-1.5 text-sm font-bold text-brand-2 hover:bg-brand-soft">Tahrirlash</button>
          {props.remove && (
            <button type="button" disabled={pending}
              onClick={() => confirm("Savol olib tashlansinmi? Javob berilgan bo'lsa, natijalardan chiqariladi.") && start(async () => setMsg(await props.remove!(props.testId, it.id)))}
              className="rounded-lg px-3 py-1.5 text-sm font-bold text-no hover:bg-no-soft">Olib tashlash</button>
          )}
        </div>
        {msg && <p role="status" className={`mt-2 text-sm font-semibold ${msg.ok ? "text-ok" : "text-no"}`}>{msg.message}</p>}
      </div>
    );
  }

  return (
    <div className="card space-y-3 !border-brand/40 !p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-mute">{it ? `#${props.index + 1}` : "Yangi savol"}</span>
        <select value={v.type} onChange={(e) => setType(e.target.value as ItemInput["type"])} className="rounded-lg border-2 border-line bg-card px-2 py-1 text-sm font-bold">
          {Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select value={v.difficulty} onChange={(e) => set({ difficulty: Number(e.target.value) as 1 | 2 | 3 })} className="rounded-lg border-2 border-line bg-card px-2 py-1 text-sm font-bold" aria-label="Qiyinlik">
          <option value={1}>Oson</option><option value={2}>O&apos;rta</option><option value={3}>Qiyin</option>
        </select>
      </div>
      {"context" in v && (v.type === "case" || v.context) && (
        <label className="block text-sm font-bold">Vaziyat
          <textarea value={v.context} onChange={(e) => set({ context: e.target.value })} rows={3} className={field} />
        </label>
      )}
      <label className="block text-sm font-bold">Savol {v.type === "fill_blank" && <span className="font-semibold text-mute">(bo&apos;sh joy — ___)</span>}
        <textarea value={v.stem} onChange={(e) => set({ stem: e.target.value })} rows={2} className={field} />
      </label>

      {"options" in v && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Variantlar — to&apos;g&apos;risini belgilang</legend>
          {v.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type={v.type === "multi" ? "checkbox" : "radio"} name={`correct-${it?.id ?? "new"}`} aria-label={`${LETTERS[i]} to'g'ri`}
                checked={v.type === "multi" ? v.correct_many.includes(i) : v.correct === i}
                onChange={(e) => v.type === "multi"
                  ? set({ correct_many: e.target.checked ? [...v.correct_many, i] : v.correct_many.filter((x) => x !== i) })
                  : set({ correct: i })}
                className="h-4 w-4 accent-brand" />
              <span className="w-5 text-sm font-bold">{LETTERS[i]}</span>
              <input value={o} onChange={(e) => set({ options: v.options.map((x, k) => (k === i ? e.target.value : x)) })} className={`${field} !mt-0`} />
              {v.options.length > 2 && (
                <button type="button" aria-label="Variantni o'chirish" onClick={() => set({
                  options: v.options.filter((_, k) => k !== i),
                  ...(v.type === "multi" ? { correct_many: v.correct_many.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)) } : { correct: v.correct === i ? 0 : v.correct > i ? v.correct - 1 : v.correct }),
                } as Partial<ItemInput>)} className="px-2 text-mute hover:text-no">✕</button>
              )}
            </div>
          ))}
          {v.options.length < 6 && <button type="button" onClick={() => set({ options: [...v.options, ""] })} className="text-sm font-bold text-brand-2">+ variant</button>}
        </fieldset>
      )}

      {v.type === "open" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Javob turi
            <select value={v.kind} onChange={(e) => set({ kind: e.target.value as "number" | "article" | "text" })} className={field}>
              <option value="text">Matn</option><option value="number">Son</option><option value="article">Modda raqami</option>
            </select>
          </label>
          <label className="block text-sm font-bold">Qabul qilinadigan javoblar <span className="font-semibold text-mute">(| bilan)</span>
            <input value={v.accepted.join(" | ")} onChange={(e) => set({ accepted: e.target.value.split("|").map((s) => s.trim()) })} className={field} />
          </label>
        </div>
      )}

      <label className="block text-sm font-bold">Izoh <span className="font-semibold text-mute">(ixtiyoriy, tavsiya etiladi)</span>
        <textarea value={v.explanation} onChange={(e) => set({ explanation: e.target.value })} rows={2} className={field} />
      </label>
      {it && it.stats && it.stats.answered > 0 && (
        <p className="text-xs font-semibold text-amber">Bu savolga {it.stats.answered} ta javob berilgan. To&apos;g&apos;ri javobni o&apos;zgartirsangiz, barcha natijalar jimgina qayta hisoblanadi.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={pending} className="btn-primary !py-2.5">{pending ? "Saqlanmoqda…" : "Saqlash"}</button>
        <button type="button" onClick={() => { setOpen(false); setV(it?.input ?? blank); setMsg(null); }} className="rounded-lg px-3 py-2 text-sm font-bold text-mute">Bekor qilish</button>
        {msg && !msg.ok && <p role="alert" className="text-sm font-semibold text-no">{msg.message}</p>}
      </div>
    </div>
  );
}
