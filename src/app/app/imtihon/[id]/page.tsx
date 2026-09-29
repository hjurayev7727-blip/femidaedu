import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { serverNow } from "@/lib/dates";
import { planLabel, type PlanItem } from "@/lib/mock";
import { localizeQuestion, QUESTION_COLUMNS, scriptOf } from "@/lib/practice";
import type { ClientQuestion, Response } from "@/lib/questions";
import { MockRunner } from "./mock-runner";

export const metadata: Metadata = { title: "Sinov imtihoni" };

export default async function MockSession({ params }: PageProps<"/app/imtihon/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, profile } = await requireUser();

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, mode, plan, finished_at, deadline_at, template_id, exam_templates(title)")
    .eq("id", id)
    .eq("user_id", profile.id)
    .eq("mode", "mock")
    .maybeSingle<{ id: string; plan: PlanItem[]; finished_at: string | null; deadline_at: string; exam_templates: { title: string } | null }>();
  if (!attempt) notFound();
  if (attempt.finished_at) redirect(`/app/imtihon/${id}/natija`);

  const ids = attempt.plan.map((p) => p.q);
  const [{ data: rows }, { data: saved }] = await Promise.all([
    supabase.from("questions").select(QUESTION_COLUMNS).in("id", ids).returns<ClientQuestion[]>(),
    supabase.from("attempt_answers").select("question_id, response").eq("attempt_id", id).returns<{ question_id: number; response: Response }[]>(),
  ]);
  const byId = new Map((rows ?? []).map((q) => [Number(q.id), q]));
  const script = scriptOf(profile);
  const items = attempt.plan.flatMap((p) => {
    const q = byId.get(p.q);
    return q ? [{ label: planLabel(p), question: localizeQuestion({ ...q, id: Number(q.id) }, script) }] : [];
  });

  return (
    <MockRunner
      attemptId={attempt.id}
      title={attempt.exam_templates?.title ?? "Sinov imtihoni"}
      deadlineMs={Date.parse(attempt.deadline_at)}
      serverNowMs={serverNow()}
      items={items}
      saved={Object.fromEntries((saved ?? []).map((s) => [Number(s.question_id), s.response]))}
    />
  );
}
