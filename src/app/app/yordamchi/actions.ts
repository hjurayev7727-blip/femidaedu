"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { StudyPlan } from "@/lib/ai";
import type { AiResult } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { PlanGoalSchema, QuestionSchema } from "@/lib/tutor";
import { askTutor, createMistakesTest, createStudyPlan, type TutorReply } from "@/lib/tutor-server";

async function premiumOf(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]) {
  const { data } = await supabase.rpc("is_premium");
  return Boolean(data);
}

/** Suhbatdagi savol (klient komponentidan) */
export async function ask(threadId: string | null, mode: unknown, question: unknown): Promise<AiResult<TutorReply>> {
  const { supabase, userId } = await requireUser();
  const q = QuestionSchema.safeParse(question);
  const m = z.enum(["explain", "case"]).safeParse(mode);
  if (!q.success) return { ok: false, message: q.error.issues[0]?.message ?? "Savolni yozing" };
  if (!m.success || (threadId !== null && !z.uuid().safeParse(threadId).success)) return { ok: false, message: "So'rov noto'g'ri." };
  const r = await askTutor(userId, await premiumOf(supabase), { threadId, mode: m.data, question: q.data });
  if (r.ok) revalidatePath("/app/yordamchi");
  return r;
}

/** Modda sahifasidan: "AI yordamchidan tushuntirish" */
export async function explainArticle(form: FormData) {
  const { supabase, userId } = await requireUser();
  const id = z.coerce.number().int().positive().safeParse(form.get("article"));
  if (!id.success) redirect("/app/yordamchi");
  const { data: a } = await supabase.from("articles").select("number, title").eq("id", id.data).maybeSingle<{ number: string; title: string | null }>();
  if (!a) redirect("/app/yordamchi");
  const r = await askTutor(userId, await premiumOf(supabase), {
    threadId: null, mode: "explain", articleId: id.data,
    question: `${a.number}-modda${a.title ? ` («${a.title}»)` : ""}ni sodda tilda, hayotiy misol bilan tushuntirib bering.`,
  });
  redirect(r.ok ? `/app/yordamchi/${r.value.threadId}` : `/app/yordamchi?xato=${encodeURIComponent(r.message)}`);
}

export async function mistakesTest() {
  const { supabase, userId } = await requireUser();
  const r = await createMistakesTest(userId, await premiumOf(supabase));
  redirect(r.ok ? `/app/testlar/${r.value.id}?yangi=${r.value.created}` : `/app/yordamchi?xato=${encodeURIComponent(r.message)}`);
}

export type PlanState = { ok: false; message: string } | { ok: true; plan: StudyPlan } | null;

export async function makePlan(_prev: PlanState, form: FormData): Promise<PlanState> {
  const { supabase, userId } = await requireUser();
  const g = PlanGoalSchema.safeParse({
    target: form.get("target"),
    field: form.get("field") || null,
    exam_date: form.get("exam_date") || null,
    minutes_per_day: Number(form.get("minutes")),
    level: form.get("level"),
  });
  if (!g.success) return { ok: false, message: g.error.issues[0]?.message ?? "Forma noto'g'ri to'ldirilgan." };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const r = await createStudyPlan(userId, await premiumOf(supabase), g.data, today);
  if (!r.ok) return r;
  revalidatePath("/app/yordamchi");
  return { ok: true, plan: r.value };
}
