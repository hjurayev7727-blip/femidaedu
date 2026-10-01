import Link from "next/link";
import { experienceLabel, fmtSum, type LawyerCard } from "@/lib/lawyers";

export function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="rounded-md bg-ok-soft px-2 py-0.5 text-xs font-bold text-ok" title="Advokatlik guvohnomasi admin tomonidan tekshirilgan">✓ Tasdiqlangan</span>
    : <span className="rounded-md bg-line px-2 py-0.5 text-xs font-bold text-mute" title="Guvohnoma hali tekshirilmagan">Tasdiqlanmagan</span>;
}

export function Stars({ rating, count }: { rating: number | null; count: number }) {
  if (!count || rating == null) return <span className="text-xs text-mute">Hali baho yo&apos;q</span>;
  return <span className="text-sm font-bold text-amber">★ {rating.toFixed(1)} <span className="font-semibold text-mute">({count})</span></span>;
}

export function LawyerListItem({ l, fieldTitles }: { l: LawyerCard; fieldTitles: Record<string, string> }) {
  return (
    <Link href={`/app/yuristlar/${l.id}`} className="card block hover:border-brand/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-extrabold">{l.display_name}</h2>
          {l.headline && <p className="text-sm text-mute">{l.headline}</p>}
        </div>
        <VerifiedBadge verified={l.verified} />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {l.fields.map((f) => <span key={f} className="tag">{fieldTitles[f] ?? f}</span>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-mute">
        <Stars rating={l.rating} count={l.rating_count} />
        {l.region && <span>📍 {l.region}</span>}
        {experienceLabel(l.experience_years) && <span>{experienceLabel(l.experience_years)}</span>}
        {l.price_from_uzs != null && <span className="font-bold text-ink">{fmtSum(l.price_from_uzs)} dan</span>}
      </div>
    </Link>
  );
}
