import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { localizeQuestion, QUESTION_COLUMNS, scriptOf } from "@/lib/practice";
import type { ClientQuestion } from "@/lib/questions";
import { PracticeRunner } from "./runner";

export const metadata: Metadata = { title: "Mashq" };
// "AI'dan so'rash" server action'i uchun
export const maxDuration = 60;

const MODE_TITLE: Record<string, string> = { review: "Takrorlash", daily: "Kunlik test", practice: "Mashq", assignment: "Vazifa" };

export default async function PracticeSession({ params }: PageProps<"/app/mashq/s/[id]">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, profile } = await requireUser();

  // RLS: faqat o'z urinishi ko'rinadi
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, mode, topic_id, question_ids, finished_at, user_id")
    .eq("id", id)
    .eq("user_id", profile.id)
    .maybeSingle<{ id: string; mode: string; topic_id: number | null; question_ids: number[]; finished_at: string | null }>();
  if (!attempt) notFound();
  if (attempt.mode === "mock") redirect(`/app/imtihon/${id}`);
  if (attempt.finished_at) redirect(`/app/mashq/s/${id}/natija`);

  const ids = attempt.question_ids.map(Number);
  const [{ data: rows }, { data: answered }, { data: topic }, { data: premium }] = await Promise.all([
    supabase.from("questions").select(QUESTION_COLUMNS).in("id", ids).returns<ClientQuestion[]>(),
    supabase.from("attempt_answers").select("question_id, is_correct").eq("attempt_id", id).returns<{ question_id: number; is_correct: boolean }[]>(),
    attempt.topic_id
      ? supabase.from("topics").select("title").eq("id", attempt.topic_id).maybeSingle<{ title: string }>()
      : Promise.resolve({ data: null }),
    supabase.rpc("is_premium"),
  ]);

  const byId = new Map((rows ?? []).map((q) => [Number(q.id), q]));
  const script = scriptOf(profile);
  const questions = ids.flatMap((qid) => {
    const q = byId.get(qid);
    return q ? [localizeQuestion({ ...q, id: Number(q.id) }, script)] : [];
  });
  if (!questions.length) notFound();

  return (
    <PracticeRunner
      attemptId={attempt.id}
      topicTitle={topic?.title ?? MODE_TITLE[attempt.mode] ?? "Mashq"}
      questions={questions}
      answeredIds={(answered ?? []).map((a) => Number(a.question_id))}
      initialCorrect={(answered ?? []).filter((a) => a.is_correct).length}
      premium={Boolean(premium)}
      aiEnabled={aiEnabled()}
    />
  );
}
