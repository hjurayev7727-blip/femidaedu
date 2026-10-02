"use client";
import { useActionState } from "react";
import type { JoinState } from "@/app/jonli/actions";

export function JoinForm({ action, pin, signedIn, name }: { action: (p: JoinState, f: FormData) => Promise<JoinState>; pin: string; signedIn: boolean; name: string }) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className="card mx-auto max-w-md space-y-4 text-center">
      <p className="text-5xl" aria-hidden>🎮</p>
      <h1 className="text-3xl font-bold">Jonli viktorina</h1>
      <label className="block text-sm font-bold">
        PIN
        <input name="pin" defaultValue={pin} required inputMode="numeric" autoComplete="off" maxLength={7} placeholder="123456"
          className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-3 text-center font-mono text-3xl font-bold tracking-[.4em] outline-none focus:border-brand" />
      </label>
      <label className="block text-left text-sm font-bold">
        Ismingiz {signedIn && <span className="font-semibold text-mute">(profil ismi)</span>}
        <input name="name" defaultValue={name} required minLength={2} maxLength={40} autoComplete="name" placeholder="Ism Familiya"
          className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 font-semibold outline-none focus:border-brand" />
      </label>
      <p className="text-xs text-mute">Ismingiz va natijangiz o&apos;qituvchi ekranida ko&apos;rinadi.</p>
      {state && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <button className="btn-gold w-full" disabled={pending}>{pending ? "Qo'shilmoqda…" : "Qo'shilish"}</button>
    </form>
  );
}
