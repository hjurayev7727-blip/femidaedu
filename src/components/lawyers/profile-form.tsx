"use client";
import { useState, useTransition } from "react";
import type { ProfileState } from "@/app/app/yurist/actions";
import { LANGUAGES, REGIONS } from "@/lib/lawyers";
import type { MyLawyerProfile } from "@/lib/lawyers-server";

const input = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand";

export function LawyerProfileForm(props: {
  profile: MyLawyerProfile | null;
  defaultName: string;
  fields: { slug: string; title: string }[];
  action: (s: ProfileState, f: FormData) => Promise<ProfileState>;
}) {
  // action prop o'rniga onSubmit: React 19 xato bo'lganda ham formani tozalab yubormasin (uzun forma)
  const [state, setState] = useState<ProfileState>(null);
  const [pending, start] = useTransition();
  const p = props.profile;
  return (
    <form className="card space-y-4" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => setState(await props.action(null, fd)));
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-bold">Ism-familiya *
          <input name="display_name" required minLength={3} maxLength={80} defaultValue={p?.display_name ?? props.defaultName} className={input} />
        </label>
        <label className="block text-sm font-bold">Qisqa tavsif
          <input name="headline" maxLength={120} defaultValue={p?.headline ?? ""} placeholder="Masalan: Advokat, mehnat va oilaviy nizolar" className={input} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-bold">Sohalar * (1–6 ta)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {props.fields.map((f) => (
            <label key={f.slug} className="flex items-center gap-1.5 rounded-lg border-2 border-line px-2.5 py-1 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
              <input type="checkbox" name="fields" value={f.slug} defaultChecked={p?.fields.includes(f.slug)} /> {f.title}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm font-bold">Hudud
          <select name="region" defaultValue={p?.region ?? ""} className={input}>
            <option value="">Tanlanmagan</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block text-sm font-bold">Tajriba (yil)
          <input name="experience_years" type="number" min={0} max={70} defaultValue={p?.experience_years ?? ""} className={input} />
        </label>
        <label className="block text-sm font-bold">Narx (so&apos;m, dan)
          <input name="price_from_uzs" type="number" min={0} step={1000} defaultValue={p?.price_from_uzs ?? ""} className={input} />
        </label>
      </div>

      <fieldset>
        <legend className="text-sm font-bold">Tillar</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {Object.entries(LANGUAGES).map(([k, v]) => (
            <label key={k} className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" name="languages" value={k} defaultChecked={p ? p.languages.includes(k) : k === "uz"} /> {v}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="block text-sm font-bold">O&apos;zingiz haqingizda
        <textarea name="bio" rows={5} maxLength={2000} defaultValue={p?.bio ?? ""} placeholder="Ta'lim, tajriba, qanday ishlar bilan shug'ullanasiz" className={input} />
      </label>

      <div className="rounded-xl bg-bg p-3">
        <p className="text-sm font-bold">Kontaktlar (mijozga faqat to&apos;lovdan keyin ko&apos;rinadi)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Telefon
            <input name="phone" defaultValue={p?.phone ?? ""} placeholder="+998 90 123 45 67" className={input} />
          </label>
          <label className="block text-sm font-bold">Telegram
            <input name="telegram" defaultValue={p?.telegram ?? ""} placeholder="@username" className={input} />
          </label>
        </div>
      </div>

      <div className="rounded-xl bg-bg p-3">
        <p className="text-sm font-bold">To&apos;lov olish uchun karta (faqat admin ko&apos;radi)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">Karta raqami {p?.payout_card_last4 && <span className="font-normal text-mute">(hozirgi: •••• {p.payout_card_last4})</span>}
            <input name="payout_card" inputMode="numeric" placeholder={p?.payout_card_last4 ? "O'zgartirish uchun yangisini yozing" : "8600 •••• •••• ••••"} className={input} />
          </label>
          <label className="block text-sm font-bold">Karta egasi
            <input name="payout_holder" maxLength={80} defaultValue={p?.payout_holder ?? ""} className={input} />
          </label>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" name="hidden" defaultChecked={p?.status === "hidden"} /> Profilni vaqtincha katalogdan yashirish
      </label>

      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      {state?.ok && <p role="status" className="text-sm font-semibold text-ok">Saqlandi ✓</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda…" : p ? "Saqlash" : "Yurist sifatida ro'yxatdan o'tish"}</button>
    </form>
  );
}
