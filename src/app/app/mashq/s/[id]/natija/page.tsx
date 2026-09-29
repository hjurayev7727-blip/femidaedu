import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ReviewList, type ReviewAnswer } from "@/components/question/review-list";
import { requireUser } from "@/lib/auth";
import { scriptOf } from "@/lib/practice";
import { startPractice, startReview } from "../../../actions";

export const metadata: Metadata = { title: "Natija" };

const MODE_TITLE: Record<string, string> = { review: "Takrorlash", daily: "Kunlik test", practice: "Mashq", assignment: "Vazifa" };

export default async function PracticeResult({ params }: PageProps<"/app/mashq/s/[id]/natija">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, profile } = await requireUser();

  // Egalik RLS orqali tekshiriladi; javoblar faqat yakunlangan urinish uchun ochiladi
  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, mode, topic_id, question_ids, finished_at, correct_count, raw_score")
    .eq("id", id)
    .eq("user_id", profile.id)
    .maybeSingle<{ id: string; mode: string; topic_id: number | null; question_ids: number[]; finished_at: string | null; correct_count: number; raw_score: number }>();
  if (!attempt) notFound();
  if (attempt.mode === "mock") redirect(`/app/imtihon/${id}/natija`);
  if (!attempt.finished_at) redirect(`/app/mashq/s/${id}`);

  const ids = attempt.question_ids.map(Number);
  const [{ data: answers }, { data: topic }] = await Promise.all([
    supabase.from("attempt_answers").select("question_id, response, is_correct").eq("attempt_id", id).returns<ReviewAnswer[]>(),
    attempt.topic_id
      ? supabase.from("topics").select("slug, title").eq("id", attempt.topic_id).maybeSingle<{ slug: string; title: string }>()
      : Promise.resolve({ data: null }),
  ]);

  const total = ids.length;
  const correct = attempt.correct_count ?? 0;
  const pct = Math.round(Number(attempt.raw_score ?? 0));
  const verdict = pct >= 90 ? "A'lo! 🏆" : pct >= 70 ? "Yaxshi natija 👍" : pct >= 50 ? "Yomon emas — xatolarni takrorlang" : "Mavzuni qayta o'qib chiqing 📖";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="bg-hero rounded-[22px] p-6 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-wider text-cyan-100">{topic?.title ?? MODE_TITLE[attempt.mode] ?? "Mashq"}</p>
        <p className="mt-2 text-5xl font-extrabold tabular-nums">{pct}%</p>
        <p className="mt-1 text-slate-300">{correct} / {total} to&apos;g&apos;ri · {verdict}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {topic && (
            <form action={startPractice}>
              <input type="hidden" name="slug" value={topic.slug} />
              <button className="btn-primary">Yana {total} ta savol</button>
            </form>
          )}
          {attempt.mode === "review" && (
            <form action={startReview}>
              <button className="btn-primary">Takrorlashni davom ettirish</button>
            </form>
          )}
          {attempt.mode === "daily" && <p className="w-full text-sm text-slate-300">Keyingi kunlik test ertaga ochiladi.</p>}
          <Link href="/app/mashq" className="btn border-2 border-white/20 text-white">Mavzular</Link>
        </div>
      </div>

      <h2 className="text-lg font-extrabold tracking-tight">Savollar tahlili</h2>
      <ReviewList ids={ids} answers={answers ?? []} script={scriptOf(profile)} />
    </div>
  );
}
