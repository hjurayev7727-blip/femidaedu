"use client";
import { useActionState, useState } from "react";
import { payManually } from "./actions";

type Plan = { code: string; title: string; price: string; months: number };

export function PayForm({ plans }: { plans: Plan[] }) {
  const [state, action, pending] = useActionState(payManually, null);
  const [fileName, setFileName] = useState<string | null>(null);

  if (state?.ok) {
    return <p role="status" className="rounded-xl bg-ok-soft px-4 py-3 font-semibold text-ok">{state.message}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="text-sm font-bold">Tarif</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {plans.map((p, i) => (
            <label key={p.code} className="flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border-2 border-line px-4 py-3 has-[:checked]:border-cyan has-[:checked]:bg-cyan-soft">
              <span className="flex items-center gap-2 font-bold">
                <input type="radio" name="plan" value={p.code} defaultChecked={i === 0} className="accent-cyan-600" />
                {p.title}
              </span>
              <span className="font-extrabold tabular-nums">{p.price}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-bold">To&apos;lov cheki (skrinshot yoki PDF, 5 MB gacha)</span>
        <span className="mt-2 flex cursor-pointer items-center gap-3 rounded-[14px] border-2 border-dashed border-line px-4 py-4 hover:border-cyan">
          <span className="text-2xl" aria-hidden>🧾</span>
          <span className="text-sm font-semibold text-mute">{fileName ?? "Faylni tanlang…"}</span>
          <input
            type="file"
            name="receipt"
            required
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </span>
      </label>

      {state && !state.ok && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{state.message}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Yuborilmoqda…" : "Chekni yuborish"}</button>
    </form>
  );
}
