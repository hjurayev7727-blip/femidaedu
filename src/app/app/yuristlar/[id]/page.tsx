import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DisabledNotice, LawyersSoon } from "@/components/lawyers/catalog-view";
import { LawyerProfileView } from "@/components/lawyers/lawyer-profile";
import { ReportForm } from "@/components/lawyers/report-form";
import { requireUser } from "@/lib/auth";
import { fieldOptions, lawyerPublic, myLawyer, ownPreview, type LawyerPublic } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { reportLawyerAction } from "../actions";

export const metadata: Metadata = { title: "Yurist" };

export default async function LawyerPage({ params }: PageProps<"/app/yuristlar/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { userId, profile } = await requireUser();
  const enabled = await lawyersEnabled();
  const own = id === userId;
  if (!enabled && profile.role !== "admin" && !own) return <LawyersSoon />;

  const [pub, fields] = await Promise.all([lawyerPublic(id), fieldOptions()]);
  let l: LawyerPublic | null = pub;
  // O'z profili yashirin bo'lsa ham egasiga oldindan ko'rish sifatida ko'rsatiladi
  if (!l && own) {
    const { profile: me } = await myLawyer(userId);
    if (me && me.status !== "blocked") l = ownPreview(me);
  }
  if (!l) notFound();

  const notice = !enabled ? <DisabledNotice /> : own && !pub ? (
    <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">Profilingiz yashirin — katalogda ko&apos;rinmaydi. Buni faqat siz ko&apos;ryapsiz.</p>
  ) : undefined;

  return (
    <LawyerProfileView l={l} fields={new Map(fields.map((f) => [f.slug, f]))} own={own} notice={notice}
      report={own ? undefined : <ReportForm lawyerId={l.id} action={reportLawyerAction} />} />
  );
}
