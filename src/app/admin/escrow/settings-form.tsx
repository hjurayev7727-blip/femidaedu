"use client";
import { useActionState } from "react";
import type { SettingsState } from "./actions";

export function EscrowSettingsForm(props: { pct: number; enabled: boolean; action: (s: SettingsState, f: FormData) => Promise<SettingsState> }) {
  const [state, action, pending] = useActionState(props.action, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-extrabold">Sozlamalar</h2>
      <label className="block text-sm font-bold">Platforma komissiyasi, % (kamida 20)
        <input name="pct" type="number" min={20} max={90} defaultValue={props.pct} className="mt-1 w-32 rounded-xl border-2 border-line bg-card px-3 py-2" />
      </label>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="enabled" defaultChecked={props.enabled} /> Yurist xizmatlari uchun to&apos;lovni yoqish
      </label>
      <p className="text-xs text-mute">⚠️ Yoqishdan oldin: mijoz pulini ushlab turish va yuristlarga o&apos;tkazish bo&apos;yicha huquqiy xulosa (to&apos;lov tashkiloti litsenziyasi, Payme/DOYSE shartnomasi, soliq) va yuristlar bilan shartnoma tayyor bo&apos;lishi kerak.</p>
      {state && <p role={state.ok ? "status" : "alert"} className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>{state.message}</p>}
      <button className="btn-primary" disabled={pending}>Saqlash</button>
    </form>
  );
}
