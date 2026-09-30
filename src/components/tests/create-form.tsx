"use client";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/app/testlar/actions";

export type DocOption = { id: number; short_title: string; field: string | null };
export type ChapterOption = { id: number; document_id: number; number: string; title: string | null };

const TYPES = [
  ["single", "Test (4 variant)"],
  ["fill_blank", "Bo'sh joy"],
  ["case", "Amaliy vaziyat"],
  ["open", "Qisqa yozma javob"],
] as const;

const SOURCES = [
  ["articles", "📚 Moddalar", "Bazadagi kodeks moddalari yoki bob"],
  ["text", "📝 Matn", "Konspekt, ma'ruza yoki qonun matni"],
  ["file", "📎 PDF / rasm", "Darslik sahifasi, skan yoki surat"],
] as const;

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 font-semibold outline-none focus:border-brand";

export function CreateTestForm(props: {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  documents: DocOption[];
  chapters: ChapterOption[];
  maxItems: number;
  premium: boolean;
  initial?: { document?: number; articles?: string; title?: string };
  aiReady: boolean;
}) {
  const [state, action, pending] = useActionState(props.action, null);
  const [source, setSource] = useState<"articles" | "text" | "file">("articles");
  const [doc, setDoc] = useState<number | "">(props.initial?.document ?? "");
  const chapters = props.chapters.filter((c) => c.document_id === doc);

  return (
    <form action={action} className="space-y-5">
      <div className="card space-y-4">
        <label className="block text-sm font-bold">
          Test nomi
          <input name="title" required minLength={3} maxLength={120} defaultValue={props.initial?.title} placeholder="Masalan: Mehnat shartnomasi — 1-bob" className={field} />
        </label>

        <fieldset>
          <legend className="text-sm font-bold">Manba</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {SOURCES.map(([v, t, hint]) => (
              <label key={v} className={`cursor-pointer rounded-xl border-2 p-3 transition-colors ${source === v ? "border-brand bg-brand-soft" : "border-line hover:border-brand/40"}`}>
                <input type="radio" name="source" value={v} checked={source === v} onChange={() => setSource(v)} className="sr-only" />
                <b className="block">{t}</b>
                <span className="text-xs text-mute">{hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm font-bold">
          Hujjat {source !== "articles" && <span className="font-semibold text-mute">(ixtiyoriy — savollarni moddalarga bog&apos;lash uchun)</span>}
          <select name="document" value={doc} onChange={(e) => setDoc(e.target.value ? Number(e.target.value) : "")} required={source === "articles"} className={field}>
            <option value="">{source === "articles" ? "Tanlang…" : "Bog'lanmasin"}</option>
            {props.documents.map((d) => (
              <option key={d.id} value={d.id}>{d.short_title}{d.field ? ` — ${d.field}` : ""}</option>
            ))}
          </select>
        </label>

        {source === "articles" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-bold">
              Moddalar
              <input name="articles" defaultValue={props.initial?.articles} placeholder="1-10, 15, 245-1" className={field} />
              <span className="mt-1 block text-xs font-semibold text-mute">40 tagacha modda</span>
            </label>
            <label className="block text-sm font-bold">
              yoki bob
              <select name="chapter" defaultValue="" className={field} disabled={!chapters.length}>
                <option value="">—</option>
                {chapters.map((c) => <option key={c.id} value={c.id}>{c.number}-bob{c.title ? `. ${c.title}` : ""}</option>)}
              </select>
            </label>
          </div>
        )}

        {source === "text" && (
          <label className="block text-sm font-bold">
            Matn
            <textarea name="text" required rows={9} minLength={200} maxLength={60000} className={`${field} font-normal`}
              placeholder="Ma'ruza konspekti yoki qonun moddalarini shu yerga joylashtiring…" />
          </label>
        )}

        {source === "file" && (
          <div className="space-y-3">
            <label className="block text-sm font-bold">
              Fayl (PDF, JPG, PNG, WEBP — 5 MB gacha)
              <input type="file" name="file" required accept="application/pdf,image/jpeg,image/png,image/webp" className={`${field} font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-bold file:text-brand-2`} />
            </label>
            <label className="block text-sm font-bold">
              Izoh <span className="font-semibold text-mute">(ixtiyoriy: qaysi mavzuga e&apos;tibor berilsin)</span>
              <input name="text" maxLength={2000} className={field} />
            </label>
          </div>
        )}
      </div>

      <div className="card flex flex-wrap items-end gap-5">
        <label className="text-sm font-bold">
          Savollar soni
          <input name="count" type="number" min={5} max={props.maxItems} defaultValue={Math.min(10, props.maxItems)} className={`${field} w-28`} />
          <span className="mt-1 block text-xs font-semibold text-mute">{props.premium ? "5–50" : "Bepul: 5–10 · Premium: 50 gacha"}</span>
        </label>
        <fieldset className="flex flex-wrap gap-x-4 gap-y-2 pb-6">
          <legend className="sr-only">Savol turlari</legend>
          {TYPES.map(([v, l]) => (
            <label key={v} className="flex items-center gap-1.5 text-sm font-semibold">
              <input type="checkbox" name="types" value={v} defaultChecked={v !== "open"} className="accent-brand" /> {l}
            </label>
          ))}
        </fieldset>
      </div>

      {state && !state.ok && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{state.message}</p>}
      {!props.aiReady && <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">AI hali ulanmagan — test yaratish vaqtincha ishlamaydi.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-gold" disabled={pending || !props.aiReady}>{pending ? "AI savollar tuzmoqda… (1–2 daqiqa)" : "🤖 Test yaratish"}</button>
        <p className="text-xs text-mute">Savollar faqat manbadan tuziladi. Keyin har birini tahrirlab, so&apos;ng ulashasiz.</p>
      </div>
    </form>
  );
}
