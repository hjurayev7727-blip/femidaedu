import Link from "next/link";
import type { ReactNode } from "react";
import { REGIONS } from "@/app/app/profil/regions";
import type { LawyerCard as Lawyer } from "@/lib/lawyers-server";
import { LawyerCard, type FieldInfo } from "./lawyer-card";

export type CatalogFilters = { field: string | null; region: string | null; q: string | null };

const select = "w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 text-sm font-semibold outline-none focus:border-brand";

function pageHref(f: CatalogFilters, page: number) {
  const p = new URLSearchParams();
  if (f.field) p.set("soha", f.field);
  if (f.region) p.set("viloyat", f.region);
  if (f.q) p.set("q", f.q);
  if (page > 0) p.set("sahifa", String(page));
  const s = p.toString();
  return s ? `/app/yuristlar?${s}` : "/app/yuristlar";
}

/** Yuristlar katalogi: soha, viloyat va qidiruv bo'yicha filtr (JS'siz GET forma), tasdiqlanganlar yuqorida */
export function LawyersCatalogView({ items, more, page, filters, fields, cta, notice }: {
  items: Lawyer[];
  more: boolean;
  page: number;
  filters: CatalogFilters;
  fields: FieldInfo[];
  cta: ReactNode;
  notice?: ReactNode;
}) {
  const byslug = new Map(fields.map((f) => [f.slug, f]));
  const filtered = Boolean(filters.field || filters.region || filters.q);
  return (
    <div className="space-y-6">
      {notice}
      <section className="bg-hero rounded-[22px] p-6 text-white">
        <p className="tag !bg-white/10 !text-gold-2">Yuristlar</p>
        <h1 className="mt-3 text-3xl font-bold">Ishingizga mos yurist toping</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Soha va viloyat bo&apos;yicha advokat yoki yurist tanlang. <b className="text-white">✓ Tasdiqlangan</b> belgisi — guvohnomasi tekshirilgan;
          baho va sharhlarni faqat xizmat uchun to&apos;lagan mijozlar qoldiradi.
        </p>
        <div className="mt-4">{cta}</div>
      </section>

      <form action="/app/yuristlar" className="card grid gap-3 !p-4 sm:grid-cols-[1fr_1fr_1.3fr_auto]" role="search">
        <label className="block">
          <span className="sr-only">Soha</span>
          <select name="soha" defaultValue={filters.field ?? ""} className={select}>
            <option value="">Barcha sohalar</option>
            {fields.map((f) => <option key={f.slug} value={f.slug}>{f.icon} {f.title}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Viloyat</span>
          <select name="viloyat" defaultValue={filters.region ?? ""} className={select}>
            <option value="">Barcha viloyatlar</option>
            {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="sr-only">Qidiruv</span>
          <input name="q" defaultValue={filters.q ?? ""} maxLength={80} placeholder="Ism yoki mavzu: ijara, aliment…" className={select} />
        </label>
        <div className="flex gap-2">
          <button className="btn-primary !px-4 !py-2.5 text-sm">Qidirish</button>
          {filtered && <Link href="/app/yuristlar" className="btn-ghost !px-3 !py-2.5 text-sm">Tozalash</Link>}
        </div>
      </form>

      {items.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((l) => <li key={l.id} className="flex"><LawyerCard l={l} fields={byslug} href={`/app/yuristlar/${l.id}`} /></li>)}
        </ul>
      ) : (
        <div className="card text-center">
          <p className="font-bold">{filtered ? "Bu filtr bo'yicha yurist topilmadi" : "Katalogda hali yurist yo'q"}</p>
          <p className="mt-1 text-sm text-mute">
            {filtered ? "Boshqa viloyat yoki sohani tanlang — ko'p yuristlar onlayn maslahat beradi." : "Birinchilardan bo'lib ro'yxatdan o'ting."}
          </p>
        </div>
      )}

      {(page > 0 || more) && (
        <nav className="flex items-center justify-between gap-3" aria-label="Sahifalar">
          {page > 0 ? <Link href={pageHref(filters, page - 1)} className="btn-ghost !px-4 !py-2 text-sm">← Oldingi</Link> : <span />}
          <span className="text-sm font-semibold text-mute">{page + 1}-sahifa</span>
          {more ? <Link href={pageHref(filters, page + 1)} className="btn-ghost !px-4 !py-2 text-sm">Keyingi →</Link> : <span />}
        </nav>
      )}

      <p className="text-xs text-mute">
        Femida Edu yuristlar bilan bog&apos;lanish uchun maydon. Tasdiqlanmagan yuristlarning malakasi tekshirilmagan.
        Kontaktlar xizmat uchun platforma orqali to&apos;lovdan keyin ochiladi; shubhali profil haqida profil sahifasidagi &quot;Shikoyat qilish&quot; orqali xabar bering.
      </p>
    </div>
  );
}

/** Bo'lim yopiq, lekin admin ko'ryapti */
export function DisabledNotice() {
  return (
    <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
      Bo&apos;lim foydalanuvchilar uchun hali yopiq — buni faqat adminlar ko&apos;radi.{" "}
      <Link href="/admin/sozlamalar" className="underline">Sozlamalarda yoqish</Link>
    </p>
  );
}

/** Bo'lim yopiq paytida (app_settings.lawyers_enabled = false) */
export function LawyersSoon() {
  return (
    <div className="mx-auto max-w-xl space-y-4 py-6 text-center">
      <p className="text-5xl" aria-hidden>⚖️</p>
      <h1 className="text-3xl font-bold">Yuristlar bo&apos;limi tez orada</h1>
      <p className="text-mute">
        Bu yerda soha va viloyat bo&apos;yicha advokat yoki yurist topib, sayt ichida murojaat qila olasiz. Hozircha savolingizga
        qonun moddalari asosida javob olishingiz mumkin.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/app/savol" className="btn-primary">💬 Savol berish</Link>
        <Link href="/app/yurist" className="btn-ghost">Siz yuristmisiz? Ro&apos;yxatdan o&apos;ting</Link>
      </div>
    </div>
  );
}
