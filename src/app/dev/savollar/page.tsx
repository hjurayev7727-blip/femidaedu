// Faqat ishlab chiqish uchun: import qilingan savollarni har turdan ko'rish (Supabase'siz).
// Production'da mavjud emas.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notFound } from "next/navigation";
import { localizeQuestion } from "@/lib/practice";
import type { Answer, ClientQuestion, Payload, QuestionType } from "@/lib/questions";
import { Demo } from "./demo";

type BundleQ = { legacyKey: string; type: QuestionType; stem: string; context: string | null; payload: Payload; answer: Answer; explanation: string | null; sourceNote: string | null; difficulty: number };

export default async function DevQuestions({ searchParams }: PageProps<"/dev/savollar">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const script = sp.yozuv === "kirill" ? "cyrillic" : "latin";

  const bundle = JSON.parse(readFileSync(join(process.cwd(), "data/v1/bundle.json"), "utf8")) as { questions: BundleQ[] };
  const pick = (pred: (q: BundleQ) => boolean) => bundle.questions.find(pred);
  const samples = [
    pick((q) => q.type === "single" && !("statements" in q.payload)),
    pick((q) => q.type === "single" && "statements" in q.payload),
    pick((q) => q.type === "fill_blank"),
    pick((q) => q.type === "case"),
    pick((q) => q.type === "matching" && (q.payload as { left: string[] }).left.length >= 4),
    pick((q) => q.type === "ordering"),
    pick((q) => q.type === "open"),
  ].filter((q): q is BundleQ => Boolean(q));

  const items = samples.map((q, i) => ({
    question: localizeQuestion(
      { id: i + 1, type: q.type, stem: q.stem, context: q.context, payload: q.payload, difficulty: q.difficulty } satisfies ClientQuestion,
      script,
    ),
    answer: q.answer,
    explanation: q.explanation,
    sourceNote: q.sourceNote,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold">
        DEV · {bundle.questions.length} ta savoldan namunalar · <a className="underline" href="?yozuv=kirill">кирилл</a> ·{" "}
        <a className="underline" href="?">lotin</a>
      </p>
      <Demo items={items} />
    </main>
  );
}
