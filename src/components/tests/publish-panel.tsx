"use client";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/app/testlar/actions";
import { REVEAL_LABEL, VISIBILITY_LABEL, type Reveal, type TestSettings, type Visibility } from "@/lib/user-tests";

const field = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand";

/** ISO → datetime-local (Toshkent vaqti) */
const toLocal = (iso?: string) => (iso ? new Date(new Date(iso).getTime() + 5 * 3600_000).toISOString().slice(0, 16) : "");

export function PublishPanel(props: {
  testId: number;
  status: string;
  visibility: Visibility;
  groupId: number | null;
  settings: Partial<TestSettings>;
  groups: { id: number; name: string }[];
  trust: number;
  moderation: string | null;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, action, pending] = useActionState(props.action, null);
  const [vis, setVis] = useState<Visibility>(props.visibility);
  const s = props.settings;
  const published = props.status === "published";

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="test" value={props.testId} />
      <div>
        <h2 className="text-xl font-bold">{published ? "Ulashish sozlamalari" : "Nashr qilish"}</h2>
        <p className="text-sm text-mute">Ishlovchilarga kartada ogohlantiriladi: natijasi va ismi muallifga ko&apos;rinadi.</p>
      </div>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Kim ko&apos;radi</legend>
        {(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((k) => (
          <label key={k} className={`cursor-pointer rounded-xl border-2 p-3 ${vis === k ? "border-brand bg-brand-soft" : "border-line"}`}>
            <input type="radio" name="visibility" value={k} checked={vis === k} onChange={() => setVis(k)} className="sr-only" />
            <b className="block text-sm">{VISIBILITY_LABEL[k].title}</b>
            <span className="text-xs text-mute">{VISIBILITY_LABEL[k].hint}</span>
          </label>
        ))}
      </fieldset>
      {vis === "group" && (
        props.groups.length ? (
          <label className="block text-sm font-bold">Guruh
            <select name="group" defaultValue={props.groupId ?? ""} required className={field}>
              <option value="" disabled>Tanlang…</option>
              {props.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        ) : <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm font-semibold text-amber">Sizda guruh yo&apos;q. Guruhni «Ustoz» bo&apos;limida yarating.</p>
      )}
      {vis === "public" && props.trust < 1 && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm">
          Katalogga chiqish uchun ishonch darajasi kerak (admin beradi, odatda ≥ 3 ta sifatli testdan keyin). Hozircha test havola bilan ishlaydi.
        </p>
      )}
      {props.moderation === "rejected" && <p className="text-sm font-semibold text-no">Oxirgi tekshiruv: katalogga chiqmadi.</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-bold">Taymer (daqiqa)
          <input name="timer" type="number" min={0} max={240} defaultValue={s.timer_min ?? ""} placeholder="yo'q" className={field} />
        </label>
        <label className="block text-sm font-bold">Ochiladi
          <input name="opens" type="datetime-local" defaultValue={toLocal(s.opens_at)} className={field} />
        </label>
        <label className="block text-sm font-bold">Yopiladi
          <input name="closes" type="datetime-local" defaultValue={toLocal(s.closes_at)} className={field} />
        </label>
        <label className="block text-sm font-bold">Urinishlar
          <input name="max_attempts" type="number" min={0} max={20} defaultValue={s.max_attempts ?? ""} placeholder="cheksiz" className={field} />
        </label>
        <label className="block text-sm font-bold sm:col-span-2">To&apos;g&apos;ri javoblar ko&apos;rsatiladi
          <select name="reveal" defaultValue={s.reveal ?? "end"} className={field}>
            {(Object.keys(REVEAL_LABEL) as Reveal[]).map((k) => <option key={k} value={k}>{REVEAL_LABEL[k]}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-4 text-sm font-semibold">
        <label className="flex items-center gap-2"><input type="checkbox" name="shuffle" defaultChecked={s.shuffle ?? false} className="accent-brand" /> Savollarni aralashtirish</label>
        <label className="flex items-center gap-2"><input type="checkbox" name="guests" defaultChecked={s.guests ?? true} className="accent-brand" /> Ro&apos;yxatdan o&apos;tmaganlar ham ishlay oladi</label>
      </div>
      <p className="text-xs text-mute">Vaqtlar Toshkent vaqtida.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-gold" disabled={pending}>{pending ? "Saqlanmoqda…" : published ? "Saqlash" : "Nashr qilish"}</button>
        {state && <p role="status" className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>{state.message}</p>}
      </div>
    </form>
  );
}
