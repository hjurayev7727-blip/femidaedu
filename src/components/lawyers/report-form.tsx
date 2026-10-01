"use client";
import { useState, useTransition } from "react";
import { REPORT_KIND } from "@/lib/lawyers";

export type ReportState = { ok: boolean; message: string } | null;

/** Yurist ustidan shikoyat (admin ko'rib chiqadi, kerak bo'lsa profilni bloklaydi) */
export function ReportForm({ lawyerId, action }: { lawyerId: string; action: (form: FormData) => Promise<ReportState> }) {
  const [state, setState] = useState<ReportState>(null);
  const [pending, start] = useTransition();
  if (state?.ok) return <p role="status" className="text-sm font-semibold text-ok">{state.message}</p>;
  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-semibold text-mute hover:text-no">⚠️ Shikoyat qilish</summary>
      <form className="mt-3 space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await action(fd)));
      }}>
        <input type="hidden" name="lawyer" value={lawyerId} />
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-bold">Sabab</legend>
          {Object.entries(REPORT_KIND).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="radio" name="kind" value={k} required className="accent-brand" /> {label}
            </label>
          ))}
        </fieldset>
        <label className="block text-sm font-bold">
          Nima bo&apos;ldi?
          <textarea name="reason" required minLength={10} maxLength={1000} rows={3}
            className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2 text-sm font-normal outline-none focus:border-brand" />
        </label>
        {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
        <button className="btn-ghost !px-3 !py-2 text-sm !text-no" disabled={pending}>{pending ? "Yuborilmoqda…" : "Shikoyatni yuborish"}</button>
        <p className="text-xs text-mute">Shikoyatni faqat admin ko&apos;radi. Yolg&apos;on shikoyat uchun akkaunt cheklanishi mumkin.</p>
      </form>
    </details>
  );
}
