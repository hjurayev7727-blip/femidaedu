"use client";
import { useActionState } from "react";
import type { RequestState } from "@/app/app/yuristlar/ariza/actions";
import { REGIONS } from "@/lib/lawyers";

const input = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand";

export function RequestForm(props: {
  action: (s: RequestState, f: FormData) => Promise<RequestState>;
  fields: { slug: string; title: string }[];
  initial: { title: string; body: string; field: string | null; from: number | null; lawyer: string | null; lawyerName: string | null };
}) {
  const [state, action, pending] = useActionState(props.action, null);
  const i = props.initial;
  return (
    <form action={action} className="card space-y-3">
      {i.from && <input type="hidden" name="from" value={i.from} />}
      {i.lawyer && <input type="hidden" name="lawyer" value={i.lawyer} />}
      {i.lawyerName && <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold">Ariza faqat <b>{i.lawyerName}</b>ga yuboriladi.</p>}
      <label className="block text-sm font-bold">Qisqacha mavzu
        <input name="title" required minLength={5} maxLength={120} defaultValue={i.title} placeholder="Masalan: Ish haqi 2 oydan beri berilmayapti" className={input} />
      </label>
      <label className="block text-sm font-bold">Vaziyatni batafsil yozing
        <textarea name="body" required minLength={20} maxLength={4000} rows={7} defaultValue={i.body}
          placeholder="Nima bo'ldi, qachon, qanday hujjatlar bor, nima natija kutyapsiz. Pasport va telefon raqamini yozmang." className={input} />
      </label>
      {!i.lawyer && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Soha
            <select name="field" defaultValue={i.field ?? ""} className={input}>
              <option value="">Bilmayman</option>
              {props.fields.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">Hudud
            <select name="region" defaultValue="" className={input}>
              <option value="">Farqi yo&apos;q</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>
      )}
      {i.from && <p className="text-xs text-mute">AI yordamchi javobi ham yuristga ko&apos;rsatiladi — u vaziyatni tezroq tushunadi.</p>}
      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Yuborilmoqda…" : "Arizani yuborish"}</button>
      <p className="text-xs text-mute">Ariza mos yuristlarga yuboriladi. Ular sayt ichida javob yozadi va narx taklif qiladi — siz tanlaysiz.</p>
    </form>
  );
}
