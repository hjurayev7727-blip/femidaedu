"use client";
import { useActionState } from "react";
import { generateQuestions } from "./actions";

const TYPES = [
  ["single", "Test (4 variant)"],
  ["fill_blank", "Bo'sh joy"],
  ["case", "Amaliy vaziyat"],
  ["open", "Yozma (qisqa javob)"],
] as const;

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand";

export function GeneratorForm({ documents }: { documents: { number: number; short_title: string; count: number }[] }) {
  const [state, action, pending] = useActionState(generateQuestions, null);
  return (
    <form action={action} className="card space-y-4">
      <div>
        <h2 className="font-extrabold">🤖 Savol generatori</h2>
        <p className="text-sm text-mute">
          AI faqat siz joylashtirgan matndan savol tuzadi. Qoralamalar ekspert tasdiqlamaguncha o&apos;quvchilarga ko&apos;rinmaydi.
        </p>
      </div>
      <label className="block text-sm font-bold">
        Hujjat
        <select name="doc" required className={field} defaultValue="">
          <option value="" disabled>Tanlang…</option>
          {documents.map((d) => (
            <option key={d.number} value={d.number}>№{d.number} {d.short_title} — {d.count} savol</option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-bold">
        Manba matni (qonun moddalari — lex.uz dan nusxalang)
        <textarea name="source" required rows={8} minLength={200} maxLength={60000} className={`${field} font-normal`}
          placeholder="12-modda. ... 13-modda. ..." />
      </label>
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm font-bold">
          Savollar soni
          <input name="count" type="number" min={3} max={10} defaultValue={6} className={`${field} w-24`} />
        </label>
        <fieldset className="flex flex-wrap gap-3 pb-2">
          <legend className="sr-only">Savol turlari</legend>
          {TYPES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" name="types" value={v} defaultChecked={v !== "case"} className="accent-brand" /> {l}
            </label>
          ))}
        </fieldset>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "AI savol tuzmoqda… (1–2 daqiqa)" : "Qoralama yaratish"}</button>
      {state && !state.ok && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{state.message}</p>}
      {state?.ok && (
        <div role="status" className="rounded-xl bg-ok-soft px-4 py-3 text-sm">
          <b className="text-ok">{state.report.created} ta qoralama yaratildi</b>
          {state.report.duplicates > 0 && ` · ${state.report.duplicates} ta takror o'tkazib yuborildi`}
          {state.report.rejected.length > 0 && (
            <span className="block text-mute">Rad etildi (format xatosi): {state.report.rejected.join("; ")}</span>
          )}
        </div>
      )}
    </form>
  );
}
