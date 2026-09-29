"use client";
import { useActionState } from "react";
import type { Profile } from "@/lib/auth";
import { saveProfile } from "./actions";
import { REGIONS } from "./regions";

const field = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-cyan";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(saveProfile, null);

  return (
    <form action={action} className="card space-y-4">
      <label className="block text-sm font-bold">
        Ism-familiya
        <input name="full_name" defaultValue={profile.full_name} required minLength={2} maxLength={80} className={field} />
      </label>

      <label className="block text-sm font-bold">
        Maqsad
        <select name="goal" defaultValue={profile.goal ?? ""} className={field}>
          <option value="">Tanlanmagan</option>
          <option value="abituriyent">Abituriyent — OTMga kirish</option>
          <option value="oqituvchi">O&apos;qituvchi — malaka / ustama</option>
          <option value="boshqa">Boshqa</option>
        </select>
      </label>

      <label className="block text-sm font-bold">
        Hudud
        <select name="region" defaultValue={profile.region ?? ""} className={field}>
          <option value="">Tanlanmagan</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <fieldset>
        <legend className="text-sm font-bold">Yozuv</legend>
        <div className="mt-1.5 flex gap-2">
          {[
            ["latin", "Lotin"],
            ["cyrillic", "Кирилл"],
          ].map(([v, l]) => (
            <label key={v} className="flex flex-1 cursor-pointer items-center gap-2 rounded-xl border-2 border-line px-3.5 py-2.5 font-semibold has-[:checked]:border-cyan has-[:checked]:bg-cyan-soft">
              <input type="radio" name="script" value={v} defaultChecked={profile.script === v} className="accent-cyan-600" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <button disabled={pending} className="btn-primary">
          {pending ? "Saqlanmoqda…" : "Saqlash"}
        </button>
        {state && (
          <p role="status" className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
