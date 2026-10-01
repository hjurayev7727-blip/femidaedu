import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Stars, VerifiedBadge } from "@/components/lawyers/lawyer-card";
import { ReportForm } from "@/components/lawyers/report-form";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { experienceLabel, fmtSum, LANGUAGES } from "@/lib/lawyers";
import { lawyerPublic } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { reportAction } from "../actions";

export const metadata: Metadata = { title: "Yurist" };

export default async function LawyerPage({ params }: PageProps<"/app/yuristlar/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, profile } = await requireUser();
  if (!(await lawyersEnabled()) && profile.role !== "admin") notFound();
  const l = await lawyerPublic(userId, id);
  if (!l) notFound();
  const { data: fields } = await supabase.from("fields").select("slug, title").in("slug", l.fields).returns<{ slug: string; title: string }[]>();
  const titles = Object.fromEntries((fields ?? []).map((f) => [f.slug, f.title]));
  const own = id === userId;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yuristlar" className="hover:underline">Yuristlar</Link> › {l.display_name}</nav>
      {l.status !== "active" && (
        <p role="status" className="rounded-xl bg-amber/15 px-4 py-3 text-sm font-semibold text-amber">
          {l.status === "blocked" ? "Profil bloklangan — katalogda ko'rinmaydi." : "Profil yashirilgan — katalogda ko'rinmaydi."}
        </p>
      )}
      <section className="card space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-extrabold">{l.display_name}</h1>
            {l.headline && <p className="text-mute">{l.headline}</p>}
          </div>
          <VerifiedBadge verified={l.verified} />
        </div>
        <div className="flex flex-wrap gap-1.5">{l.fields.map((f) => <span key={f} className="tag">{titles[f] ?? f}</span>)}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-mute">
          <Stars rating={l.rating} count={l.rating_count} />
          {l.region && <span>📍 {l.region}</span>}
          {experienceLabel(l.experience_years) && <span>{experienceLabel(l.experience_years)}</span>}
          <span>🗣 {l.languages.map((k) => LANGUAGES[k as keyof typeof LANGUAGES] ?? k).join(", ")}</span>
          <span>Platformada {fmtUz(l.since)} dan</span>
        </div>
        {l.price_from_uzs != null && <p className="font-bold">Xizmat narxi: {fmtSum(l.price_from_uzs)} dan</p>}
        {l.bio && <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{l.bio}</p>}
      </section>

      {own ? (
        <Link href="/app/yurist" className="btn-primary">Profilni tahrirlash</Link>
      ) : (
        <section className="card space-y-3">
          <h2 className="font-extrabold">Bog&apos;lanish</h2>
          <p className="text-sm text-mute">
            Telefon va Telegram xizmat uchun to&apos;lov qilingandan keyin ochiladi. To&apos;lov platformada saqlanadi va siz
            &quot;Bajarildi&quot; deb tasdiqlaganingizdan so&apos;ng (yoki 3 kun ichida e&apos;tiroz bo&apos;lmasa) yuristga o&apos;tadi.
          </p>
          <p className="rounded-xl bg-brand-soft px-3 py-2 text-sm font-semibold">Sayt ichida yozishma va ariza qoldirish tez orada ishga tushadi.</p>
          <div className="border-t border-line pt-3"><ReportForm lawyerId={l.id} action={reportAction} /></div>
        </section>
      )}
    </div>
  );
}
