"use client";
import { useActionState, useState } from "react";
import type { ReportState } from "@/app/app/yuristlar/actions";

export function ReportForm({ lawyerId, action }: { lawyerId: string; action: (s: ReportState, f: FormData) => Promise<ReportState> }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, null);
  if (state?.ok) return <p role="status" className="text-sm font-semibold text-ok">Shikoyatingiz qabul qilindi. Admin ko&apos;rib chiqadi.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="text-sm font-bold text-no hover:underline">⚠️ Shikoyat qilish</button>;
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="lawyer" value={lawyerId} />
      <label className="block text-sm font-bold">Nima bo&apos;ldi?
        <textarea name="reason" required minLength={10} maxLength={1000} rows={3}
          className="mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand" />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary !py-2 !text-sm" disabled={pending}>Yuborish</button>
        <button type="button" className="btn-ghost !py-2 !text-sm" onClick={() => setOpen(false)}>Bekor qilish</button>
      </div>
    </form>
  );
}
