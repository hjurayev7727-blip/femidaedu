"use client";
import { useState, useTransition } from "react";
import { REGIONS } from "@/app/app/profil/regions";
import { formatPhone, LAWYER_KIND, LAWYER_LANG, MAX_LAWYER_FIELDS } from "@/lib/lawyers";
import type { MyLawyer } from "@/lib/lawyers-server";
import type { FieldInfo } from "./lawyer-card";

export type SaveLawyerState = { ok: boolean; message: string } | null;

const input = "mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-brand";
const hint = "mt-1 block text-xs font-normal text-mute";

/** Yurist profili: ro'yxatdan o'tish va tahrirlash */
export function LawyerForm({ initial, fields, action }: {
  initial: MyLawyer | null;
  fields: FieldInfo[];
  action: (form: FormData) => Promise<SaveLawyerState>;
}) {
  // action prop o'rniga onSubmit: React xatoda ham formani tozalab yubormasin (uzun forma)
  const [state, setState] = useState<SaveLawyerState>(null);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<string[]>(initial?.fields ?? []);
  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length < MAX_LAWYER_FIELDS ? [...p, slug] : p));

  return (
    <form className="space-y-5" onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      start(async () => setState(await action(fd)));
    }}>
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Asosiy ma&apos;lumot</h2>
        <fieldset>
          <legend className="text-sm font-bold">Siz kimsiz?</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {Object.entries(LAWYER_KIND).map(([k, label]) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-line px-3 py-2.5 font-bold has-[:checked]:border-brand has-[:checked]:bg-brand-soft">
                <input type="radio" name="kind" value={k} defaultChecked={(initial?.kind ?? "yurist") === k} className="accent-brand" />
                {label}
              </label>
            ))}
          </div>
          <span className={hint}>Advokat — advokatlik litsenziyasi bor. Yurist — yuridik ma&apos;lumotli maslahatchi (sudda vakillik qilmaydi).</span>
        </fieldset>
        <label className="block text-sm font-bold">
          Ism-familiya
          <input name="display_name" required minLength={3} maxLength={80} defaultValue={initial?.display_name ?? ""} placeholder="Masalan: Dilnoza Karimova" className={input} />
          <span className={hint}>Hujjatingizdagi kabi. Tasdiqlangandan keyin o&apos;zgartirilsa, belgi qayta tekshiriladi.</span>
        </label>
        <label className="block text-sm font-bold">
          Qisqa tavsif
          <input name="headline" maxLength={120} defaultValue={initial?.headline ?? ""} placeholder="Masalan: Mehnat va oilaviy nizolar bo'yicha maslahat" className={input} />
        </label>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Faoliyat</h2>
        <fieldset>
          <legend className="text-sm font-bold">Sohalar <span className="font-semibold text-mute">({picked.length}/{MAX_LAWYER_FIELDS})</span></legend>
          <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {fields.map((f) => {
              const on = picked.includes(f.slug);
              return (
                <label key={f.slug} className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${on ? "border-brand bg-brand-soft" : "border-line"} ${!on && picked.length >= MAX_LAWYER_FIELDS ? "opacity-50" : ""}`}>
                  <input type="checkbox" name="fields" value={f.slug} checked={on} onChange={() => toggle(f.slug)}
                    disabled={!on && picked.length >= MAX_LAWYER_FIELDS} className="accent-brand" />
                  <span aria-hidden>{f.icon}</span> {f.title}
                </label>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Viloyat
            <select name="region" required defaultValue={initial?.region ?? ""} className={input}>
              <option value="" disabled>Tanlang</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Tajriba (yil)
            <input name="experience_years" type="number" min={0} max={60} defaultValue={initial?.experience_years ?? 0} className={input} />
          </label>
        </div>
        <fieldset>
          <legend className="text-sm font-bold">Tillar</legend>
          <div className="mt-1.5 flex flex-wrap gap-3">
            {Object.entries(LAWYER_LANG).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="languages" value={k} defaultChecked={(initial?.languages ?? ["uz"]).includes(k)} className="accent-brand" /> {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm font-bold">
          Maslahat narxi (so&apos;mdan boshlab)
          <input name="price_from_uzs" inputMode="numeric" defaultValue={initial?.price_from_uzs ?? ""} placeholder="Masalan: 150 000" className={`${input} tabular-nums`} />
          <span className={hint}>Bo&apos;sh qoldirsangiz — &quot;Narx kelishiladi&quot;.</span>
        </label>
        <label className="block text-sm font-bold">
          Batafsil
          <textarea name="bio" maxLength={2000} rows={6} defaultValue={initial?.bio ?? ""}
            placeholder="Ma'lumotingiz, qaysi ishlar bilan shug'ullanasiz, qanday yordam bera olasiz."
            className={`${input} font-normal`} />
          <span className={hint}>Bu yerda telefon, Telegram yoki havola yozmang — ular avtomatik rad etiladi.</span>
        </label>
      </section>

      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold">Kontaktlar <span className="text-sm font-semibold text-mute">· yashirin</span></h2>
          <p className="mt-1 text-sm text-mute">🔒 Mijozga faqat xizmat uchun platforma orqali to&apos;lagandan keyin ko&apos;rinadi. Katalogda ko&apos;rsatilmaydi.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Telefon
            <input name="phone" type="tel" inputMode="tel" maxLength={30} defaultValue={initial?.phone ? formatPhone(initial.phone) : ""} placeholder="+998 90 123 45 67" className={input} />
          </label>
          <label className="block text-sm font-bold">
            Telegram
            <input name="telegram" maxLength={60} defaultValue={initial?.telegram ? `@${initial.telegram}` : ""} placeholder="@username" className={input} />
          </label>
        </div>
      </section>

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="visible" defaultChecked={initial ? initial.status !== "hidden" : true} className="accent-brand" />
          Profilim katalogda ko&apos;rinsin
        </label>
        <div className="flex flex-wrap items-center gap-3">
          {state && <span role={state.ok ? "status" : "alert"} className={`text-sm font-semibold ${state.ok ? "text-ok" : "text-no"}`}>{state.message}</span>}
          <button className="btn-primary" disabled={pending}>{pending ? "Saqlanmoqda…" : initial ? "Saqlash" : "Ro'yxatdan o'tish"}</button>
        </div>
      </section>
    </form>
  );
}
