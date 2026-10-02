"use client";
import { useActionState, useState } from "react";
import type { PlanState } from "@/app/app/yordamchi/actions";
import type { StudyPlan } from "@/lib/ai";

const field = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold outline-none focus:border-brand";

/** Reja ko'rinishi: joriy hafta ochiq, qolganlari yig'ilgan */
export function PlanView({ plan, currentWeek }: { plan: StudyPlan; currentWeek: number }) {
  return (
    <div className="space-y-3">
      <p className="text-mute">{plan.summary}</p>
      {plan.weeks.map((w) => (
        <details key={w.week} open={w.week === Math.min(currentWeek, plan.weeks.length)} className="card !p-4">
          <summary className="cursor-pointer font-bold">
            {w.week}-hafta: {w.focus} {w.week === currentWeek && <span className="ml-1 rounded-md bg-gold-soft px-2 py-0.5 text-xs text-gold">joriy</span>}
          </summary>
          <ul className="mt-3 space-y-2">
            {w.days.map((d, i) => (
              <li key={i} className="rounded-xl bg-bg px-3 py-2 text-sm">
                <b>{d.day}</b> <span className="text-mute">· {d.minutes} daq</span>
                <ul className="mt-1 list-disc pl-5">{d.tasks.map((t, k) => <li key={k}>{t}</li>)}</ul>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export function PlanForm(props: {
  action: (prev: PlanState, form: FormData) => Promise<PlanState>;
  fields: { slug: string; title: string }[];
  defaultExam: string;
  aiReady: boolean;
  hasPlan: boolean;
}) {
  const [state, action, pending] = useActionState(props.action, null);
  const [target, setTarget] = useState<"sertifikat" | "soha">("sertifikat");
  return (
    <div className="space-y-4">
      <form action={action} className="card space-y-4">
        <h2 className="text-xl font-bold">{props.hasPlan ? "Rejani yangilash" : "O'quv reja tuzish"}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Maqsad
            <select name="target" value={target} onChange={(e) => setTarget(e.target.value as "sertifikat" | "soha")} className={field}>
              <option value="sertifikat">Milliy sertifikat</option>
              <option value="soha">Huquq sohasini o&apos;rganish</option>
            </select>
          </label>
          {target === "soha" ? (
            <label className="block text-sm font-bold">Soha
              <select name="field" required className={field} defaultValue="">
                <option value="" disabled>Tanlang…</option>
                {props.fields.map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
              </select>
            </label>
          ) : (
            <label className="block text-sm font-bold">Imtihon sanasi
              <input type="date" name="exam_date" defaultValue={props.defaultExam} className={field} />
            </label>
          )}
          <label className="block text-sm font-bold">Kuniga (daqiqa)
            <input type="number" name="minutes" min={15} max={240} step={5} defaultValue={45} className={field} />
          </label>
          <label className="block text-sm font-bold">Hozirgi daraja
            <select name="level" defaultValue="o'rta" className={field}>
              <option value="boshlang'ich">Boshlang&apos;ich</option>
              <option value="o'rta">O&apos;rta</option>
              <option value="yuqori">Yuqori</option>
            </select>
          </label>
        </div>
        <p className="text-xs text-mute">Zaif moddalaringiz avtomatik hisobga olinadi. Reja AI ustoz limitidan 1 ta so&apos;rov oladi.</p>
        {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
        <button className="btn-gold" disabled={pending || !props.aiReady}>{pending ? "Reja tuzilmoqda… (1 daqiqagacha)" : "🗓️ Reja tuzish"}</button>
      </form>
      {state?.ok && <PlanView plan={state.plan} currentWeek={1} />}
    </div>
  );
}
