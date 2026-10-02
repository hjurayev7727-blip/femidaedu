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
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { lawyersEnabled } from "@/lib/legal-server";
import { startChat } from "@/app/app/suhbatlar/actions";
import { reportAction } from "../actions";

export const metadata: Metadata = { title: "Yurist" };

export default async function LawyerPage({ params, searchParams }: PageProps<"/app/yuristlar/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId, profile } = await requireUser();
  if (!(await lawyersEnabled()) && profile.role !== "admin") notFound();
  const l = await lawyerPublic(userId, id);
  if (!l) notFound();
  const admin = createSupabaseAdmin();
  const [{ data: fields }, { data: reviews }, { data: contacts }] = await Promise.all([
    supabase.from("fields").select("slug, title").in("slug", l.fields).returns<{ slug: string; title: string }[]>(),
    admin.rpc("lawyer_reviews_public", { p_lawyer: id, p_limit: 20 }),
    admin.rpc("lawyer_contacts", { p_user: userId, p_lawyer: id }),
  ]);
  const revs = (reviews ?? []) as { rating: number; body: string | null; created_at: string; client: string }[];
  const c = contacts as { phone: string | null; telegram: string | null } | null;
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

      {revs.length > 0 && (
        <section className="card space-y-3">
          <h2 className="font-extrabold">Mijozlar fikri</h2>
          <ul className="space-y-3">
            {revs.map((r, i) => (
              <li key={i} className="border-b border-line pb-3 last:border-0 last:pb-0">
                <p className="text-sm"><span className="font-bold text-amber">{"★".repeat(r.rating)}<span className="text-line">{"★".repeat(5 - r.rating)}</span></span> · {r.client} · <span className="text-mute">{fmtUz(r.created_at)}</span></p>
                {r.body && <p className="mt-1 whitespace-pre-wrap text-sm">{r.body}</p>}
              </li>
            ))}
          </ul>
          <p className="text-xs text-mute">Faqat platforma orqali to&apos;lab xizmat olgan mijozlar baho qoldira oladi.</p>
        </section>
      )}

      {own ? (
        <Link href="/app/yurist" className="btn-primary">Profilni tahrirlash</Link>
      ) : (
        <section className="card space-y-3">
          <h2 className="font-extrabold">Bog&apos;lanish</h2>
          {c && (c.phone || c.telegram) && (
            <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm">{c.phone && <>📞 <a href={`tel:${c.phone}`} className="font-bold">{c.phone}</a> </>}{c.telegram && <>✈️ <a href={`https://t.me/${c.telegram}`} target="_blank" rel="noreferrer" className="font-bold">@{c.telegram}</a></>}</p>
          )}
          <p className="text-sm text-mute">
            Telefon va Telegram xizmat uchun to&apos;lov qilingandan keyin ochiladi. To&apos;lov platformada saqlanadi va siz
            &quot;Bajarildi&quot; deb tasdiqlaganingizdan so&apos;ng (yoki 3 kun ichida e&apos;tiroz bo&apos;lmasa) yuristga o&apos;tadi.
          </p>
          {typeof sp.xato === "string" && <p role="alert" className="text-sm font-semibold text-no">{sp.xato.slice(0, 200)}</p>}
          {l.status === "active" && (
            <div className="flex flex-wrap gap-2">
              <form action={startChat}><input type="hidden" name="lawyer" value={l.id} /><button className="btn-primary">💬 Xabar yozish</button></form>
              <Link href={`/app/yuristlar/ariza?lawyer=${l.id}`} className="btn-ghost">📩 Ariza yuborish</Link>
            </div>
          )}
          <div className="border-t border-line pt-3"><ReportForm lawyerId={l.id} action={reportAction} /></div>
        </section>
      )}
    </div>
  );
}
