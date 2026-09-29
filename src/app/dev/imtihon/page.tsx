// Faqat ishlab chiqish uchun: sinov imtihoni interfeysi (Supabase'siz, haqiqiy savollar bazasidan reja).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { MockRunner } from "@/app/app/imtihon/[id]/mock-runner";
import { serverNow } from "@/lib/dates";
import { buildMockPlan, planLabel, type Blueprint } from "@/lib/mock";
import type { ClientQuestion, Payload, QuestionType } from "@/lib/questions";

type BundleQ = { type: QuestionType; stem: string; context: string | null; payload: Payload; difficulty: number; documentNumber: number | null };

export default function DevMock() {
  if (process.env.NODE_ENV === "production") notFound();
  const root = process.cwd();
  const bundle = JSON.parse(readFileSync(join(root, "data/v1/bundle.json"), "utf8")) as { questions: BundleQ[] };
  const seed = readFileSync(join(root, "supabase/seed.sql"), "utf8");
  const bp = JSON.parse(/'(\{\s*"sections"[\s\S]*?\})'::jsonb/.exec(seed)![1]) as Blueprint;

  const qs = bundle.questions.map((q, i) => ({ ...q, id: i + 1 }));
  const plan = buildMockPlan(qs.map((q) => ({ id: q.id, type: q.type, difficulty: q.difficulty, documentId: q.documentNumber })), bp);
  const byId = new Map(qs.map((q) => [q.id, q]));
  const items = plan.map((p) => {
    const q = byId.get(p.q)!;
    return { label: planLabel(p), question: { id: q.id, type: q.type, stem: q.stem, context: q.context, payload: q.payload, difficulty: q.difficulty } satisfies ClientQuestion };
  });
  const now = serverNow();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold">DEV · sinov imtihoni interfeysi (javoblar saqlanmaydi)</p>
      <MockRunner attemptId="dev" title="Milliy sertifikat — to'liq sinov" deadlineMs={now + 90 * 60_000} serverNowMs={now} items={items} saved={{}} demo />
    </main>
  );
}
