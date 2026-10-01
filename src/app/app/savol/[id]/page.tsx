import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { LegalChatMessage } from "@/components/legal/answer-card";
import { LegalChat } from "@/components/legal/legal-chat";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import type { Confidence } from "@/lib/legal";
import { lawyersEnabled } from "@/lib/legal-server";
import { sourceRef } from "@/lib/tutor";
import { askLegalAction } from "../actions";

export const metadata: Metadata = { title: "Savol bering" };
export const maxDuration = 60;

type Msg = {
  role: "user" | "assistant"; content: string; article_ids: number[];
  confidence: Confidence | null; needs_lawyer: boolean; doc_meta: { name?: string; type?: string; pages?: number } | null;
};
type Art = { id: number; number: string; documents: { short_title: string; fields: { slug: string } | null } | null };

export default async function LegalThread({ params }: PageProps<"/app/savol/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  // RLS: faqat o'z suhbati
  const { data: t } = await supabase.from("tutor_threads").select("id, mode, title").eq("id", id).eq("user_id", userId)
    .maybeSingle<{ id: string; mode: string; title: string }>();
  if (!t) notFound();
  if (t.mode !== "legal" && t.mode !== "document") redirect(`/app/yordamchi/${t.id}`);
  const [{ data: msgs }, lawyers] = await Promise.all([
    supabase.from("tutor_messages").select("role, content, article_ids, confidence, needs_lawyer, doc_meta").eq("thread_id", id).order("id").limit(200).returns<Msg[]>(),
    lawyersEnabled(),
  ]);
  const ids = [...new Set((msgs ?? []).flatMap((m) => m.article_ids.map(Number)))];
  const { data: arts } = ids.length
    ? await supabase.from("articles").select("id, number, documents(short_title, fields(slug))").in("id", ids).returns<Art[]>()
    : { data: [] as Art[] };
  const byId = new Map((arts ?? []).map((a) => [Number(a.id), a]));
  const messages: LegalChatMessage[] = (msgs ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    doc: m.doc_meta ? { name: m.doc_meta.name ?? "hujjat", type: m.doc_meta.type ?? "", pages: m.doc_meta.pages ?? 0 } : null,
    confidence: m.confidence,
    needsLawyer: m.needs_lawyer,
    sources: m.article_ids.flatMap((aid) => {
      const a = byId.get(Number(aid));
      return a ? [{ id: Number(a.id), ref: sourceRef({ doc_title: a.documents?.short_title ?? "", number: a.number }), field: a.documents?.fields?.slug ?? null }] : [];
    }),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm font-semibold text-mute">
        <Link href="/app/savol" className="hover:underline">Savol bering</Link> › {t.mode === "document" ? "Hujjat tahlili" : "Savol"}
      </nav>
      <h1 className="text-2xl font-bold">{t.mode === "document" ? "📄" : "💬"} {t.title}</h1>
      <LegalChat threadId={t.id} messages={messages} ask={askLegalAction} aiReady={aiEnabled()} lawyersEnabled={lawyers} />
    </div>
  );
}
