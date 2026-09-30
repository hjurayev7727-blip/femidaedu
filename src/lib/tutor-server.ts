import "server-only";
import { generateStudyPlan, tutorAnswer, type StudyPlan, type TutorMode, type TutorTurn } from "@/lib/ai";
import { aiClient, logUsage, type AiResult } from "@/lib/ai-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import {
  extractArticleRefs, mergeSources, sourceRef, threadTitle, TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY,
  type PlanGoal, type SourceArticle,
} from "@/lib/tutor";
import { createAiTest, type CreateReport } from "@/lib/user-tests-server";

const FAIL = {
  unavailable: "AI ustoz hozircha ulanmagan.",
  error: "AI javob bera olmadi. Birozdan keyin urinib ko'ring.",
  refusal: "AI bu savolga javob bermadi. Savolni o'quv mavzusi sifatida qayta yozib ko'ring.",
};
const limitText = (premium: boolean) =>
  premium ? "Haftalik AI ustoz limiti tugadi." : `Bu haftalik bepul limit (${TUTOR_FREE_WEEKLY} ta savol) tugadi. Premium bilan ko'proq.`;

type ArticleJoin = { id: number; number: string; title: string | null; body: string; document_id: number; documents: { short_title: string; fields: { slug: string } | null } | null };
const ARTICLE_COLS = "id, number, title, body, document_id, documents(short_title, fields(slug))";
const toSource = (a: ArticleJoin): SourceArticle => ({
  id: Number(a.id), number: a.number, title: a.title, body: a.body, doc_title: a.documents?.short_title ?? "", field_slug: a.documents?.fields?.slug ?? null,
});

/** Savolga manba moddalar: suhbat moddasi, uning hujjatidagi raqam bilan ko'rsatilganlari, keyin to'liq matnli qidiruv */
async function findSources(question: string, anchorArticle: number | null): Promise<SourceArticle[]> {
  const admin = createSupabaseAdmin();
  const explicit: SourceArticle[] = [];
  let docId: number | null = null;
  if (anchorArticle) {
    const { data } = await admin.from("articles").select(ARTICLE_COLS).eq("id", anchorArticle).maybeSingle<ArticleJoin>();
    if (data) {
      explicit.push(toSource(data));
      docId = data.document_id;
    }
  }
  const refs = extractArticleRefs(question);
  if (refs.length && docId) {
    const { data } = await admin.from("articles").select(ARTICLE_COLS).eq("document_id", docId).in("number", refs).neq("status", "repealed").returns<ArticleJoin[]>();
    explicit.push(...(data ?? []).map(toSource));
  }
  const { data: found } = await admin.rpc("search_articles", { p_query: question, p_field: null, p_limit: 6 });
  const searched = ((found ?? []) as (Omit<SourceArticle, "id"> & { id: number })[]).map((a) => ({ ...a, id: Number(a.id) }));
  return mergeSources(explicit, searched);
}

export type TutorReply = { threadId: string; answer: string; sources: { id: number; ref: string; field: string | null }[] };

/** AI ustozga savol: yangi suhbat (threadId null) yoki davomi. Haftalik limit atomar; AI xatosida qaytariladi. */
export async function askTutor(
  userId: string, premium: boolean,
  opts: { threadId: string | null; mode: TutorMode; question: string; articleId?: number | null },
): Promise<AiResult<TutorReply>> {
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL.unavailable };
  const admin = createSupabaseAdmin();

  let mode = opts.mode;
  let anchor = opts.articleId ?? null;
  let history: TutorTurn[] = [];
  if (opts.threadId) {
    const { data: t } = await admin.from("tutor_threads").select("id, user_id, mode, article_id").eq("id", opts.threadId)
      .maybeSingle<{ id: string; user_id: string; mode: TutorMode; article_id: number | null }>();
    if (!t || t.user_id !== userId) return { ok: false, message: "Suhbat topilmadi." };
    mode = t.mode;
    anchor = t.article_id;
    const { data: msgs } = await admin.from("tutor_messages").select("role, content").eq("thread_id", t.id).order("id", { ascending: false }).limit(8)
      .returns<TutorTurn[]>();
    history = (msgs ?? []).reverse();
  }

  const { data: used } = await admin.rpc("consume_tutor_quota", { p_user: userId, p_limit: premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY });
  if (used == null) return { ok: false, message: limitText(premium) };

  const sources = await findSources(opts.question, anchor);
  const r = await tutorAnswer(c, { mode, history, question: opts.question, sources: sources.map((s) => ({ ref: sourceRef(s), title: s.title, body: s.body })) });
  if (!r.ok) {
    await admin.rpc("refund_tutor_quota", { p_user: userId });
    return { ok: false, message: r.reason === "refusal" ? FAIL.refusal : FAIL.error };
  }
  await logUsage(userId, `tutor_${mode}`, r.usage);

  let threadId = opts.threadId;
  if (!threadId) {
    const { data: t, error } = await admin.from("tutor_threads").insert({ user_id: userId, mode, title: threadTitle(opts.question), article_id: anchor })
      .select("id").single<{ id: string }>();
    if (error || !t) return { ok: false, message: "Saqlab bo'lmadi." };
    threadId = t.id;
  } else {
    await admin.from("tutor_threads").update({ mode }).eq("id", threadId); // updated_at yangilanadi
  }
  await admin.from("tutor_messages").insert([
    { thread_id: threadId, role: "user", content: opts.question.slice(0, 3000) },
    { thread_id: threadId, role: "assistant", content: r.data.slice(0, 12000), article_ids: sources.map((s) => s.id) },
  ]);
  return { ok: true, value: { threadId, answer: r.data, sources: sources.map((s) => ({ id: s.id, ref: sourceRef(s), field: s.field_slug })) } };
}

/** Zaif moddalar bo'yicha AI test (test limitiga kiradi) */
export async function createMistakesTest(userId: string, premium: boolean): Promise<AiResult<CreateReport>> {
  const { data } = await createSupabaseAdmin().rpc("weak_articles", { p_user: userId, p_limit: 10 });
  const weak = (data ?? []) as { article_id: number; document_id: number; doc_title: string }[];
  if (!weak.length) return { ok: false, message: "Hali xato qilingan moddalar yo'q — avval sohalar bo'yicha test ishlang." };
  // Bitta hujjat (eng ko'p xatolisi) — savollar shu hujjat moddalariga bog'lanadi
  const doc = weak[0].document_id;
  const ids = weak.filter((w) => w.document_id === doc).map((w) => Number(w.article_id));
  return createAiTest(userId, premium, {
    title: `Xatolarim: ${weak[0].doc_title}`,
    field: null,
    source: { kind: "articles", articleIds: ids },
    count: premium ? Math.min(20, Math.max(5, ids.length * 2)) : 10,
    types: ["single", "case", "fill_blank"],
  });
}

/** O'quv reja: AI tuzadi (ustoz limitidan 1 ta), oldingi reja almashtiriladi */
export async function createStudyPlan(userId: string, premium: boolean, goal: PlanGoal, today: string): Promise<AiResult<StudyPlan>> {
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL.unavailable };
  const admin = createSupabaseAdmin();
  const { data: used } = await admin.rpc("consume_tutor_quota", { p_user: userId, p_limit: premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY });
  if (used == null) return { ok: false, message: limitText(premium) };

  const [{ data: weak }, { data: field }] = await Promise.all([
    admin.rpc("weak_articles", { p_user: userId, p_limit: 20 }),
    goal.field ? admin.from("fields").select("title").eq("slug", goal.field).maybeSingle<{ title: string }>() : Promise.resolve({ data: null }),
  ]);
  const r = await generateStudyPlan(c, {
    target: goal.target, field: field?.title ?? null, examDate: goal.exam_date, minutesPerDay: goal.minutes_per_day, level: goal.level, today,
    weak: ((weak ?? []) as { doc_title: string; number: string; title: string | null }[]).map((w) => `${w.doc_title} ${w.number}-modda ${w.title ?? ""}`.trim()),
  });
  if (!r.ok || !r.data.weeks.length) {
    await admin.rpc("refund_tutor_quota", { p_user: userId });
    return { ok: false, message: r.ok ? FAIL.error : r.reason === "refusal" ? FAIL.refusal : FAIL.error };
  }
  await logUsage(userId, "study_plan", r.usage);
  const plan: StudyPlan = { ...r.data, weeks: r.data.weeks.slice(0, 8) };
  await admin.from("study_plans").upsert({ user_id: userId, goal, plan, created_at: new Date().toISOString() });
  return { ok: true, value: plan };
}
