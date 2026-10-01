import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { TutorChat, type ChatMessage } from "@/components/tutor/chat";
import type { TutorMode } from "@/lib/ai";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { MODE_INFO, sourceRef } from "@/lib/tutor";
import { ask } from "../actions";

export const metadata: Metadata = { title: "AI yordamchi" };
export const maxDuration = 60;

type Msg = { role: "user" | "assistant"; content: string; article_ids: number[] };
type Art = { id: number; number: string; documents: { short_title: string; fields: { slug: string } | null } | null };

export default async function TutorThread({ params }: PageProps<"/app/yordamchi/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, userId } = await requireUser();
  // RLS: faqat o'z suhbati
  const { data: t } = await supabase.from("tutor_threads").select("id, mode, title").eq("id", id).eq("user_id", userId)
    .maybeSingle<{ id: string; mode: TutorMode; title: string }>();
  if (!t) notFound();
  const { data: msgs } = await supabase.from("tutor_messages").select("role, content, article_ids").eq("thread_id", id).order("id").limit(200).returns<Msg[]>();
  const ids = [...new Set((msgs ?? []).flatMap((m) => m.article_ids.map(Number)))];
  const { data: arts } = ids.length
    ? await supabase.from("articles").select("id, number, documents(short_title, fields(slug))").in("id", ids).returns<Art[]>()
    : { data: [] as Art[] };
  const byId = new Map((arts ?? []).map((a) => [Number(a.id), a]));
  const messages: ChatMessage[] = (msgs ?? []).map((m) => ({
    role: m.role,
    content: m.content,
    sources: m.article_ids.flatMap((aid) => {
      const a = byId.get(Number(aid));
      return a ? [{ id: Number(a.id), ref: sourceRef({ doc_title: a.documents?.short_title ?? "", number: a.number }), field: a.documents?.fields?.slug ?? null }] : [];
    }),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yordamchi" className="hover:underline">AI yordamchi</Link> › {MODE_INFO[t.mode].title}</nav>
      <h1 className="text-2xl font-bold">{MODE_INFO[t.mode].icon} {t.title}</h1>
      <TutorChat threadId={t.id} mode={t.mode} messages={messages} ask={ask} aiReady={aiEnabled()} />
    </div>
  );
}
