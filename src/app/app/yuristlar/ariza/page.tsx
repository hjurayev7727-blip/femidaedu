import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { RequestForm } from "@/components/chat/request-form";
import { requireUser } from "@/lib/auth";
import { lawyerPublic } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { threadTitle } from "@/lib/tutor";
import { createRequestAction } from "./actions";

export const metadata: Metadata = { title: "Yuristga ariza" };

export default async function RequestPage({ searchParams }: PageProps<"/app/yuristlar/ariza">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireUser();
  if (!(await lawyersEnabled())) notFound();
  const from = z.coerce.number().int().positive().safeParse(sp.from);
  const lawyer = z.uuid().safeParse(sp.lawyer);

  // AI javobidan: o'z suhbatidagi xabar va undan oldingi savol (RLS: faqat o'ziniki)
  let title = "", body = "", field: string | null = null, fromId: number | null = null;
  if (from.success) {
    const { data: m } = await supabase.from("tutor_messages").select("id, thread_id, role, tutor_threads(user_id, title, field)").eq("id", from.data)
      .maybeSingle<{ id: number; thread_id: string; role: string; tutor_threads: { user_id: string; title: string; field: string | null } | null }>();
    if (m && m.role === "assistant" && m.tutor_threads?.user_id === userId) {
      const { data: q } = await supabase.from("tutor_messages").select("content").eq("thread_id", m.thread_id).eq("role", "user").lt("id", m.id)
        .order("id", { ascending: false }).limit(1).maybeSingle<{ content: string }>();
      title = threadTitle(m.tutor_threads.title).slice(0, 120);
      body = (q?.content ?? "").slice(0, 4000);
      field = m.tutor_threads.field;
      fromId = Number(m.id);
    }
  }
  const target = lawyer.success ? await lawyerPublic(userId, lawyer.data) : null;
  if (lawyer.success && (!target || target.status !== "active" || target.id === userId)) notFound();
  const { data: fields } = await supabase.from("fields").select("slug, title").order("priority").order("title").returns<{ slug: string; title: string }[]>();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yuristlar" className="hover:underline">Yuristlar</Link> › Ariza</nav>
      <h1 className="text-2xl font-extrabold tracking-tight">Yuristga ariza</h1>
      <RequestForm action={createRequestAction} fields={fields ?? []}
        initial={{ title, body, field, from: fromId, lawyer: target?.id ?? null, lawyerName: target?.display_name ?? null }} />
    </div>
  );
}
