import type { Metadata } from "next";
import Link from "next/link";
import { PlanForm, PlanView } from "@/components/tutor/plan";
import type { StudyPlan } from "@/lib/ai";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { currentPlanWeek } from "@/lib/tutor";
import { makePlan } from "../actions";

export const metadata: Metadata = { title: "O'quv reja" };
export const maxDuration = 120;

export default async function PlanPage() {
  const { supabase, userId } = await requireUser();
  const [{ data: plan }, { data: fields }] = await Promise.all([
    supabase.from("study_plans").select("plan, created_at").eq("user_id", userId).maybeSingle<{ plan: StudyPlan; created_at: string }>(),
    supabase.from("fields").select("slug, title").order("sort").returns<{ slug: string; title: string }[]>(),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yordamchi" className="hover:underline">AI yordamchi</Link> › O&apos;quv reja</nav>
      <h1 className="text-3xl font-bold">O&apos;quv reja</h1>
      {plan && (
        <section className="space-y-3">
          <p className="text-sm text-mute">Tuzilgan: {fmtUz(plan.created_at, { time: false })}</p>
          <PlanView plan={plan.plan} currentWeek={currentPlanWeek(plan.created_at)} />
        </section>
      )}
      <PlanForm action={makePlan} fields={fields ?? []} defaultExam="2026-12-23" aiReady={aiEnabled()} hasPlan={Boolean(plan)} />
    </div>
  );
}
