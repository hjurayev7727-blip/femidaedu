import type { Metadata } from "next";
import Link from "next/link";
import { DisabledNotice, LawyersCatalogView, LawyersSoon } from "@/components/lawyers/catalog-view";
import { requireUser } from "@/lib/auth";
import { fieldOptions, hasLawyerProfile, lawyerCatalog } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { REGIONS } from "../profil/regions";

export const metadata: Metadata = { title: "Yuristlar" };

export default async function LawyersPage({ searchParams }: PageProps<"/app/yuristlar">) {
  const { userId, profile } = await requireUser();
  const enabled = await lawyersEnabled();
  if (!enabled && profile.role !== "admin") return <LawyersSoon />;

  const sp = await searchParams;
  const fields = await fieldOptions();
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");
  const field = fields.some((f) => f.slug === one(sp.soha)) ? one(sp.soha) : null;
  const region = (REGIONS as readonly string[]).includes(one(sp.viloyat)) ? one(sp.viloyat) : null;
  const q = one(sp.q).slice(0, 80) || null;
  const page = Math.min(Math.max(Number.parseInt(one(sp.sahifa), 10) || 0, 0), 500);
  const [{ items, more }, mine] = await Promise.all([lawyerCatalog({ field, region, q, page }), hasLawyerProfile(userId)]);

  return (
    <LawyersCatalogView items={items} more={more} page={page} filters={{ field, region, q }} fields={fields}
      notice={enabled ? undefined : <DisabledNotice />}
      cta={mine
        ? <Link href="/app/yurist" className="btn-gold !px-4 !py-2 text-sm">Yurist kabinetim</Link>
        : <Link href="/app/yurist" className="text-sm font-bold text-gold-2 underline">Siz yuristmisiz? Bepul ro&apos;yxatdan o&apos;ting →</Link>} />
  );
}
