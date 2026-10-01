import Link from "next/link";
import type { ReactNode } from "react";
import { paragraphs } from "@/lib/fields";
import { LAWYER_KIND } from "@/lib/lawyers";
import type { LawyerPublic } from "@/lib/lawyers-server";
import { formatUzs } from "@/lib/payments";
import { langList, LawyerAvatar, Rating, VerifiedBadge, type FieldInfo } from "./lawyer-card";

/** Yuristning ochiq profili (kontaktlarsiz). Murojaat tugmalari 5-bosqichda (chat va ariza) ishga tushadi. */
export function LawyerProfileView({ l, fields, own = false, notice, report }: {
  l: LawyerPublic;
  fields: Map<string, FieldInfo>;
  own?: boolean;
  notice?: ReactNode;
  report?: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <Link href="/app/yuristlar" className="text-sm font-semibold text-brand hover:underline">← Yuristlar</Link>
      {notice}

      <section className="bg-hero rounded-[22px] p-6 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <LawyerAvatar name={l.display_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-bold">{l.display_name}</h1>
            {l.headline && <p className="mt-1 text-slate-300">{l.headline}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="tag !bg-white/10 !text-gold-2">{LAWYER_KIND[l.kind]}</span>
              <VerifiedBadge verified={l.verified} />
              <span className="text-sm text-slate-300">📍 {l.region}</span>
            </div>
          </div>
        </div>
      </section>

      {!l.verified && (
        <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          Bu yuristning guvohnomasi yoki diplomi Femida Edu tomonidan hali tekshirilmagan. Murojaat qilishdan oldin malakasini so&apos;rang.
        </p>
      )}

      <div className="grid gap-5 md:grid-cols-[1fr_300px]">
        <div className="space-y-5">
          <section className="card">
            <h2 className="text-lg font-bold">Haqida</h2>
            {l.bio ? (
              <div className="mt-2 space-y-2 leading-relaxed">{paragraphs(l.bio).map((p, i) => <p key={i}>{p}</p>)}</div>
            ) : <p className="mt-2 text-mute">Yurist o&apos;zi haqida hali yozmagan.</p>}
          </section>

          <section className="card">
            <h2 className="text-lg font-bold">Sohalar</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {l.fields.map((s) => {
                const f = fields.get(s);
                return (
                  <li key={s}>
                    <Link href={`/app/sohalar/${s}`} className="inline-block rounded-lg bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand-2 hover:underline">
                      {f ? `${f.icon} ${f.title}` : s}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Sharhlar</h2>
              <Rating rating={l.rating} count={l.rating_count} />
            </div>
            <p className="mt-2 text-sm text-mute">Baho va sharhni faqat platforma orqali xizmat uchun to&apos;lagan mijozlar qoldiradi.</p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card space-y-3">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-mute">Tajriba</dt><dd className="text-right font-bold">{l.experience_years > 0 ? `${l.experience_years} yil` : "1 yildan kam"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-mute">Tillar</dt><dd className="text-right font-bold">{langList(l.languages)}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-mute">Narx</dt>
                <dd className="text-right font-bold">{l.price_from_uzs ? `${formatUzs(l.price_from_uzs)}dan` : "Kelishiladi"}</dd>
              </div>
            </dl>
            {own ? (
              <Link href="/app/yurist" className="btn-primary w-full justify-center">Profilni tahrirlash</Link>
            ) : (
              <div className="space-y-2">
                <button type="button" disabled className="btn-primary w-full justify-center opacity-60">💬 Xabar yozish</button>
                <button type="button" disabled className="btn-ghost w-full justify-center opacity-60">📝 Ariza yuborish</button>
                <p className="text-center text-xs font-semibold text-mute">Sayt ichida yozishish tez orada</p>
              </div>
            )}
            <p className="rounded-lg bg-bg px-3 py-2 text-xs text-mute">
              🔒 Telefon va Telegram xizmat uchun platforma orqali to&apos;lovdan keyin ochiladi — pulingiz va kelishuvingiz himoyalangan bo&apos;ladi.
            </p>
          </section>
          {report && <section className="card">{report}</section>}
        </aside>
      </div>
    </div>
  );
}
