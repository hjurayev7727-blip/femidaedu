import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ReviewList, type ReviewAnswer } from "@/components/question/review-list";
import { requireUser } from "@/lib/auth";
import { planLabel, type Breakdown, type Grade, type PlanItem } from "@/lib/mock";
import { scriptOf } from "@/lib/practice";
import { startReview } from "../../../mashq/actions";

export const metadata: Metadata = { title: "Sinov natijasi" };

type Attempt = {
  id: string;
  plan: PlanItem[];
  finished_at: string | null;
  started_at: string;
  raw_score: number;
  scaled_score: number;
  grade: string | null;
  correct_count: number;
  breakdown: Breakdown | null;
  exam_templates: { title: string; scale_max: number; raw_max: number; grades: Grade[] } | null;
};

const pct = (e: number, m: number) => (m ? Math.round((e / m) * 100) : 0);

export default async function MockResult({ params }: PageProps<"/app/imtihon/[id]/natija">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, profile } = await requireUser();

  const { data: a } = await supabase
    .from("attempts")
    .select("id, plan, finished_at, started_at, raw_score, scaled_score, grade, correct_count, breakdown, exam_templates(title, scale_max, raw_max, grades)")
    .eq("id", id)
    .eq("user_id", profile.id)
    .eq("mode", "mock")
    .maybeSingle<Attempt>();
  if (!a) notFound();
  if (!a.finished_at) redirect(`/app/imtihon/${id}`);

  const { data: answers } = await supabase
    .from("attempt_answers")
    .select("question_id, response, is_correct")
    .eq("attempt_id", id)
    .returns<ReviewAnswer[]>();

  const t = a.exam_templates;
  const grades = [...(t?.grades ?? [])].sort((x, y) => y.min - x.min);
  const scaled = Number(a.scaled_score);
  const minutes = Math.round((Date.parse(a.finished_at) - Date.parse(a.started_at)) / 60000);
  const next = grades.filter((g) => g.min > scaled).at(-1);
  const b = a.breakdown;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="bg-hero rounded-[22px] p-6 text-center text-white">
        <p className="text-sm font-bold uppercase tracking-wider text-gold-2">{t?.title ?? "Sinov imtihoni"}</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <span className={`rounded-2xl px-4 py-2 text-4xl font-extrabold ${a.grade ? "bg-accent" : "bg-white/10"}`}>{a.grade ?? "—"}</span>
          <div className="text-left">
            <p className="text-4xl font-extrabold tabular-nums">{scaled}<span className="text-lg text-slate-400"> / {Number(t?.scale_max ?? 75)}</span></p>
            <p className="text-sm text-slate-300">birlamchi {Number(a.raw_score)} / {Number(t?.raw_max ?? 100)} · {a.correct_count}/{a.plan.length} to&apos;g&apos;ri · {minutes} daq</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-300">
          {a.grade ? `Tabriklaymiz! ${a.grade} daraja.` : "Sertifikat darajasiga (C — 46 ball) hali yetmadi."}
          {next && ` ${next.grade} uchun yana ${Math.round((next.min - scaled) * 10) / 10} ball kerak.`}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Taxminiy natija: haqiqiy imtihonda ball Rasch modeli bilan hisoblanadi.
        </p>
      </div>

      {b && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card">
            <p className="text-xs font-extrabold uppercase tracking-wider text-mute">Qismlar</p>
            <Bar label="Yopiq (1–35)" earned={b.closed.earned} max={b.closed.max} />
            <Bar label="Yozma (36–45)" earned={b.written.earned} max={b.written.max} />
          </div>
          <div className="card">
            <p className="text-xs font-extrabold uppercase tracking-wider text-mute">Darajalar</p>
            <ul className="mt-2 grid grid-cols-3 gap-1.5 text-center text-sm">
              {grades.map((g) => (
                <li key={g.grade} className={`rounded-lg py-1.5 font-bold ${a.grade === g.grade ? "bg-accent text-white" : "bg-bg"}`}>
                  {g.grade} <span className="font-normal text-mute">{g.min}+</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {b && b.byDoc.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between gap-3">
            <p className="font-extrabold">Mavzular bo&apos;yicha — eng zaiflari birinchi</p>
            <form action={startReview}>
              <button className="btn-ghost px-3! py-2! text-sm!">Xatolarni takrorlash</button>
            </form>
          </div>
          <ul className="mt-3 space-y-2.5">
            {b.byDoc.map((d) => (
              <li key={`${d.doc}-${d.title}`}>
                <Bar label={d.doc ? `№${d.doc} ${d.title}` : d.title} earned={d.earned} max={d.max} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href="/app/imtihon" className="btn-primary">Sinovlar sahifasi</Link>
        <Link href="/app/mashq" className="btn-ghost">Mashq qilish</Link>
      </div>

      <details className="card">
        <summary className="cursor-pointer font-extrabold">Barcha javoblar tahlili ({a.plan.length})</summary>
        <div className="mt-4">
          <ReviewList
            ids={a.plan.map((p) => p.q)}
            labels={a.plan.map(planLabel)}
            answers={answers ?? []}
            script={scriptOf(profile)}
          />
        </div>
      </details>
    </div>
  );
}

function Bar({ label, earned, max }: { label: string; earned: number; max: number }) {
  const p = pct(earned, max);
  return (
    <div className="mt-2">
      <div className="flex justify-between gap-2 text-sm">
        <span className="truncate font-semibold">{label}</span>
        <span className="shrink-0 tabular-nums text-mute">{earned} / {max}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
        <div className={`h-full ${p >= 70 ? "bg-ok" : p >= 50 ? "bg-amber" : "bg-no"}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}
