// Faqat ishlab chiqish uchun: savol tahrirlagichi (saqlash Supabase'siz ishlamaydi).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { QuestionEditor } from "@/app/app/kontent/savollar/[id]/editor";
import { longestOptionBias } from "@/lib/bias";

type B = { type: string; stem: string; context: string | null; payload: { options?: string[] }; answer: { index?: number }; explanation: string | null; sourceNote: string | null; difficulty: number };

export default function DevEditor() {
  if (process.env.NODE_ENV === "production") notFound();
  const { questions } = JSON.parse(readFileSync(join(process.cwd(), "data/v1/bundle.json"), "utf8")) as { questions: B[] };
  const q = questions.find((x) => x.type === "single" && x.payload.options && longestOptionBias(x.payload.options, x.answer.index!).biased)!;
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold">DEV · tahrirlagich (saqlanmaydi)</p>
      <QuestionEditor q={{ id: 1, version: 1, type: q.type, stem: q.stem, context: q.context, options: q.payload.options!, statements: null,
        correct: q.answer.index!, kind: null, accepted: null, show: null, explanation: q.explanation, source_note: q.sourceNote,
        difficulty: q.difficulty, status: "published", readonlyStructure: null }} />
    </main>
  );
}
