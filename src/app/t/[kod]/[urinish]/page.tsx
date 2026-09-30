import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { TestRunner } from "@/components/tests/test-runner";
import type { ClientQuestion, Response } from "@/lib/questions";
import { currentActor, finishTestAttempt, loadAttempt } from "@/lib/user-tests-server";
import { answerItem, finishTest } from "../../actions";

export const metadata: Metadata = { title: "Test", robots: { index: false } };

export default async function RunTestPage({ params }: PageProps<"/t/[kod]/[urinish]">) {
  const { kod, urinish } = await params;
  if (!z.uuid().safeParse(urinish).success) notFound();
  const loaded = await loadAttempt(urinish, await currentActor());
  if (!loaded || loaded.test.code !== kod.toUpperCase()) notFound();
  const { test, attempt, items, answers } = loaded;
  // eslint-disable-next-line react-hooks/purity -- server komponenti: har so'rovda joriy vaqt
  const now = Date.now();
  const expired = attempt.deadlineAt != null && new Date(attempt.deadlineAt).getTime() + 30_000 < now;
  if (attempt.finishedAt || expired) {
    if (!attempt.finishedAt) await finishTestAttempt(attempt.id);
    redirect(`/t/${test.code}/${attempt.id}/natija`);
  }

  // Klientga javob kalitisiz savollar; reveal=each bo'lsa — javob berilganlarning natijasi
  const questions: ClientQuestion[] = items.map((i) => ({ id: i.id, type: i.type, stem: i.stem, context: i.context, payload: i.payload, difficulty: i.difficulty }));
  const saved: Record<number, Response> = {};
  const shown: Record<number, { correct: boolean; answer: typeof items[number]["answer"]; explanation: string | null }> = {};
  for (const i of items) {
    const a = answers.get(i.id);
    if (!a) continue;
    saved[i.id] = a.response;
    if (test.reveal === "each") shown[i.id] = { correct: a.is_correct, answer: i.answer, explanation: i.explanation };
  }

  return (
    <TestRunner
      code={test.code}
      attemptId={attempt.id}
      title={test.title}
      reveal={test.reveal}
      items={questions}
      saved={saved}
      shown={shown}
      deadlineMs={attempt.deadlineAt ? new Date(attempt.deadlineAt).getTime() : null}
      serverNowMs={now}
      answer={answerItem}
      finish={finishTest}
    />
  );
}
