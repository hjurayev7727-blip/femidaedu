import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { LegalChat, type LegalMessage } from "@/components/legal/legal-chat";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import type { Confidence, DocMeta } from "@/lib/legal";
import { lawyersEnabled } from "@/lib/legal-server";
import { sourceRef } from "@/lib/tutor";
import { askLegalAction } from "../actions";

export const metadata: Metadata = { title: "Savol bering" };
export const maxDuration = 120;

type Msg = { id: number; role: "user" | "assistant"; content: string; article_ids: number[]; confidence: Confidence | null; needs_lawyer: boolean; doc_meta: DocMeta | null };
type Art = { id: number; number: string; documents: { short_title: string; fields: { slug: string } | null } | null };

export default async function SavolThread({ params }: PageProps<"/app/savol/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  // RLS: faqat o'z suhbati
  const { data: t } = await supabase.from("tutor_threads").select("id, mode, title").eq("id", id).eq("user_id", userId).in("mode", ["legal", "document"])
    .maybeSingle<{ id: string; mode: "legal" | "document"; title: string }>();
  if (!t) notFound();
  const [{ data: msgs }, lawyers] = await Promise.all([
    supabase.from("tutor_messages").select("id, role, content, article_ids, confidence, needs_lawyer, doc_meta").eq("thread_id", id).order("id").limit(200).returns<Msg[]>(),
    lawyersEnabled(),
  ]);
  const ids = [...new Set((msgs ?? []).flatMap((m) => m.article_ids.map(Number)))];
  const { data: arts } = ids.length
    ? await supabase.from("articles").select("id, number, documents(short_title, fields(slug))").in("id", ids).returns<Art[]>()
    : { data: [] as Art[] };
  const byId = new Map((arts ?? []).map((a) => [Number(a.id), a]));
  const messages: LegalMessage[] = (msgs ?? []).map((m) => ({
    id: Number(m.id),
    role: m.role,
    content: m.content,
    confidence: m.confidence,
    needsLawyer: m.needs_lawyer,
    doc: m.doc_meta,
    sources: m.article_ids.flatMap((aid) => {
      const a = byId.get(Number(aid));
      return a ? [{ id: Number(a.id), ref: sourceRef({ doc_title: a.documents?.short_title ?? "", number: a.number }), field: a.documents?.fields?.slug ?? null }] : [];
    }),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/savol" className="hover:underline">Savol bering</Link> › {t.mode === "document" ? "Hujjat tahlili" : "Savol"}</nav>
      <h1 className="text-2xl font-bold">{t.mode === "document" ? "📄" : "💬"} {t.title}</h1>
      {/* key: yangi xabar saqlangach (router.refresh) holat serverdagi ro'yxatdan, xabar raqamlari bilan qayta olinadi */}
      <LegalChat key={messages.at(-1)?.id ?? 0} threadId={t.id} messages={messages} ask={askLegalAction} aiReady={aiEnabled()} lawyersEnabled={lawyers} readOnly={t.mode === "document"} />
      {t.mode === "document" && (
        <Link href="/app/savol?tab=hujjat" className="btn-ghost">📄 Boshqa hujjatni tekshirish</Link>
      )}
    </div>
  );
}
