"use client";
import { useActionState } from "react";
import type { ManualPaymentSettings, Plan } from "@/lib/payments";
import { savePaymentSettings, savePlan, type SaveState } from "./actions";

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-cyan";

function Status({ state }: { state: SaveState }) {
  return state ? <span role="status" className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>{state.message}</span> : null;
}

export function PaymentSettingsForm({ value }: { value: ManualPaymentSettings }) {
  const [state, action, pending] = useActionState(savePaymentSettings, null);
  return (
    <form action={action} className="card space-y-4">
      <h2 className="font-extrabold">Qo&apos;lda to&apos;lov rekvizitlari</h2>
      <label className="block text-sm font-bold">
        Karta raqami (bo&apos;sh qoldirilsa — to&apos;lov formasi yopiladi)
        <input name="card" defaultValue={value.card} inputMode="numeric" placeholder="8600 1234 5678 9012" className={`${field} font-mono`} />
      </label>
      <label className="block text-sm font-bold">
        Karta egasi
        <input name="holder" defaultValue={value.holder} maxLength={80} className={field} />
      </label>
      <label className="block text-sm font-bold">
        Izoh (foydalanuvchiga ko&apos;rinadi)
        <textarea name="note" defaultValue={value.note} maxLength={300} rows={2} className={field} />
      </label>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>Saqlash</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function PlanForm({ plan }: { plan: Plan }) {
  const [state, action, pending] = useActionState(savePlan, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 px-5 py-4">
      <input type="hidden" name="code" value={plan.code} />
      <label className="text-sm font-bold">
        Nomi
        <input name="title" defaultValue={plan.title} className={`${field} w-28`} />
      </label>
      <label className="text-sm font-bold">
        Oy
        <input name="months" type="number" min={1} max={24} defaultValue={plan.months} className={`${field} w-20`} />
      </label>
      <label className="text-sm font-bold">
        Narx (so&apos;m)
        <input name="price_uzs" inputMode="numeric" defaultValue={plan.price_uzs} className={`${field} w-32 tabular-nums`} />
      </label>
      <label className="flex items-center gap-2 pb-3 text-sm font-bold">
        <input type="checkbox" name="is_active" defaultChecked={plan.is_active} className="accent-cyan-600" /> Faol
      </label>
      <button className="btn-ghost mb-0.5 px-4! py-2.5! text-sm!" disabled={pending}>Saqlash</button>
      <Status state={state} />
    </form>
  );
}
