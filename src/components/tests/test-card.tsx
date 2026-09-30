"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { StartState } from "@/app/t/actions";
import { fmtUz } from "@/lib/dates";
import { REVEAL_LABEL, type Reveal } from "@/lib/user-tests";

export type CardData = {
  id: number; code: string; title: string; description: string | null; author: string; trust: number; is_owner: boolean;
  field: { slug: string; title: string; icon: string } | null; items: number; rating: number | null; rating_n: number; attempts: number;
  settings: { timer_min?: number; opens_at?: string; closes_at?: string; max_attempts?: number; reveal?: Reveal; guests?: boolean };
  own_material: boolean; my_finished: number; open_attempt: string | null;
};

const TRUST = ["", "✓ Ishonchli muallif", "⚖️ Tasdiqlangan yurist/o'qituvchi", "★ Ekspert"];
const dt = (iso: string) => fmtUz(iso);

/** Ulashilgan test kartasi: ma'lumot, shartlar, "natijangiz muallifga ko'rinadi" ogohlantirishi, boshlash */
export function TestCard({ card: c, signedIn, action, loginHref, now }: {
  card: CardData;
  now: number;
  signedIn: boolean;
  action: (prev: StartState, form: FormData) => Promise<StartState>;
  loginHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const s = c.settings;
  const notOpen = s.opens_at && new Date(s.opens_at).getTime() > now;
  const closed = s.closes_at && new Date(s.closes_at).getTime() <= now;
  const noAttempts = !c.is_owner && s.max_attempts != null && c.my_finished >= s.max_attempts && !c.open_attempt;
  const guestsAllowed = (s.guests ?? true) && s.max_attempts == null; // urinishlar cheklangan bo'lsa — faqat kirganlar

  return (
    <div className="space-y-4">
      <section className="card relative overflow-hidden">
        <span className="bg-accent absolute inset-x-0 top-0 h-1.5" aria-hidden />
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          {c.field && <span className="tag">{c.field.icon} {c.field.title}</span>}
          <code className="rounded-md bg-brand-soft px-2 py-1 font-mono tracking-widest text-brand-2">{c.code}</code>
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight">{c.title}</h1>
        {c.description && <p className="mt-2 text-mute">{c.description}</p>}
        <p className="mt-3 text-sm font-semibold">
          Muallif: {c.author || "Ishtirokchi"} {c.trust > 0 && <span className="ml-1 rounded-md bg-gold-soft px-2 py-0.5 text-xs text-gold">{TRUST[c.trust]}</span>}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["Savollar", String(c.items)],
            ["Vaqt", s.timer_min ? `${s.timer_min} daqiqa` : "Cheklanmagan"],
            ["Baho", c.rating != null ? `★ ${c.rating.toFixed(1)} (${c.rating_n})` : "—"],
            ["Ishlangan", `${c.attempts} marta`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-bg px-3 py-2">
              <dt className="text-xs font-bold uppercase tracking-wider text-mute">{k}</dt>
              <dd className="font-extrabold">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-4 space-y-1 text-sm text-mute">
          {s.opens_at && <li>🕘 Ochiladi: {dt(s.opens_at)}</li>}
          {s.closes_at && <li>⏳ Yopiladi: {dt(s.closes_at)}</li>}
          {s.max_attempts && <li>🔁 Urinishlar: {s.max_attempts} ta{c.my_finished ? ` (siz ${c.my_finished} marta ishlagansiz)` : ""}</li>}
          <li>✅ To&apos;g&apos;ri javoblar: {REVEAL_LABEL[s.reveal ?? "end"].toLowerCase()}</li>
          {c.own_material && <li>📎 Muallifning o&apos;z materiali asosida (bazadagi moddalar bilan tekshirilmagan)</li>}
        </ul>
      </section>

      <section className="card space-y-4">
        <p className="rounded-xl bg-gold-soft px-4 py-3 text-sm font-semibold">
          ⓘ Natijangiz va ismingiz test muallifiga ko&apos;rinadi.
        </p>
        {notOpen ? <p className="font-bold text-amber">Test hali ochilmagan.</p>
          : closed ? <p className="font-bold text-no">Test muddati tugagan.</p>
          : noAttempts ? <p className="font-bold text-no">Urinishlar soni tugagan.</p>
          : !signedIn && !guestsAllowed ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="font-semibold">Bu testni ishlash uchun tizimga kiring.</p>
              <Link href={loginHref} className="btn-primary">Kirish</Link>
            </div>
          ) : (
            <form action={formAction} className="space-y-3">
              <input type="hidden" name="code" value={c.code} />
              {!signedIn && (
                <label className="block text-sm font-bold">
                  Ism-familiyangiz
                  <input name="name" required minLength={2} maxLength={60} autoComplete="name" placeholder="Ism Familiya"
                    className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 font-semibold outline-none focus:border-brand" />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-gold" disabled={pending}>{pending ? "Boshlanmoqda…" : c.open_attempt ? "Davom ettirish" : "Boshlash"}</button>
                {!signedIn && <Link href={loginHref} className="text-sm font-bold text-brand-2 hover:underline">yoki Telegram bilan kiring — natija saqlanadi</Link>}
              </div>
              {state && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
            </form>
          )}
        {c.is_owner && <Link href={`/app/testlar/${c.id}`} className="block text-sm font-bold text-brand-2 hover:underline">Muallif sahifasi →</Link>}
      </section>
    </div>
  );
}
