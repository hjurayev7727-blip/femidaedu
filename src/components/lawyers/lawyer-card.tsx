import Link from "next/link";
import { experienceLabel, LAWYER_KIND, LAWYER_LANG, type LawyerLang } from "@/lib/lawyers";
import type { LawyerCard as Lawyer } from "@/lib/lawyers-server";
import { formatUzs } from "@/lib/payments";

export type FieldInfo = { slug: string; title: string; icon: string };

/** "Tasdiqlangan" (guvohnomasi admin tomonidan tekshirilgan) yoki aniq "Tasdiqlanmagan" yorlig'i */
export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 rounded-md bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok" title="Guvohnomasi Femida Edu tomonidan tekshirilgan">
      <span aria-hidden>✓</span> Tasdiqlangan
    </span>
  ) : (
    <span className="inline-flex items-center rounded-md bg-line px-2 py-0.5 text-xs font-bold text-mute" title="Malakasi Femida Edu tomonidan tekshirilmagan">
      Tasdiqlanmagan
    </span>
  );
}

/** Ism-familiyaning bosh harflari (rasm yuklanmaydi — shaxsiy ma'lumot kamroq) */
export function LawyerAvatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-full bg-navy font-bold text-gold-2 ring-2 ring-gold/40 ${size === "lg" ? "h-20 w-20 text-2xl" : "h-12 w-12 text-base"}`}>
      {initials || "⚖"}
    </span>
  );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (!count || rating == null) return <span className="text-xs font-semibold text-mute">Hali sharh yo&apos;q</span>;
  return (
    <span className="text-sm font-bold" title="Faqat xizmat uchun to'lagan mijozlar baho qo'yadi">
      <span className="text-gold" aria-hidden>★</span> {rating.toFixed(1)} <span className="font-semibold text-mute">({count})</span>
    </span>
  );
}

export const langList = (langs: string[]) => langs.map((l) => LAWYER_LANG[l as LawyerLang] ?? l).join(", ");

/** Katalogdagi yurist kartasi */
export function LawyerCard({ l, fields, href }: { l: Lawyer; fields: Map<string, FieldInfo>; href: string }) {
  return (
    <Link href={href} className="card group flex w-full flex-col gap-3 transition-transform hover:-translate-y-0.5 hover:border-brand/40">
      <div className="flex items-start gap-3">
        <LawyerAvatar name={l.display_name} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold group-hover:underline">{l.display_name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="tag">{LAWYER_KIND[l.kind]}</span>
            <VerifiedBadge verified={l.verified} />
          </div>
        </div>
      </div>
      {l.headline && <p className="line-clamp-2 text-sm">{l.headline}</p>}
      <ul className="flex flex-wrap gap-1.5" aria-label="Sohalar">
        {l.fields.slice(0, 3).map((s) => {
          const f = fields.get(s);
          return <li key={s} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand-2">{f ? `${f.icon} ${f.title}` : s}</li>;
        })}
        {l.fields.length > 3 && <li className="rounded-md bg-line px-2 py-0.5 text-xs font-bold text-mute">+{l.fields.length - 3}</li>}
      </ul>
      <p className="text-xs font-semibold text-mute">📍 {l.region} · {experienceLabel(l.experience_years)} · {langList(l.languages)}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        <Rating rating={l.rating} count={l.rating_count} />
        <span className="text-sm font-bold">{l.price_from_uzs ? `${formatUzs(l.price_from_uzs)}dan` : "Narx kelishiladi"}</span>
      </div>
    </Link>
  );
}
