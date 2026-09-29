import "server-only";
import { esc } from "@/lib/bot/api";
import { notifyUser } from "@/lib/bot/server";
import { gradeResponse, type Answer, type Payload, type QuestionType, type Response } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";

type Q = { id: number; type: QuestionType; payload: Payload; answer: Answer };

/**
 * Urinish javoblarini baholaydi — faqat musobaqa tugagach (SQL ham tekshiradi). Qayta chaqirish xavfsiz.
 * Muddatidan oldin tugatish uchun — close_contest_attempt (baholamaydi, natija sizib chiqmasin).
 */
export async function gradeContestAttempt(attemptId: string): Promise<boolean> {
  const admin = createSupabaseAdmin();
  const { data: a } = await admin.from("attempts").select("id, question_ids, mode").eq("id", attemptId).eq("mode", "contest")
    .maybeSingle<{ id: string; question_ids: number[] }>();
  if (!a) return false;
  const [{ data: questions }, { data: answers }] = await Promise.all([
    admin.from("questions").select("id, type, payload, answer").in("id", a.question_ids.map(Number)).returns<Q[]>(),
    admin.from("attempt_answers").select("question_id, response").eq("attempt_id", attemptId).returns<{ question_id: number; response: Response }[]>(),
  ]);
  const byId = new Map((questions ?? []).map((q) => [Number(q.id), q]));
  const results = (answers ?? []).map((ans) => {
    const q = byId.get(Number(ans.question_id));
    return { q: Number(ans.question_id), correct: Boolean(q && gradeResponse(q.type, q.payload, q.answer, ans.response).correct) };
  });
  const { data, error } = await admin.rpc("finish_contest_attempt", { p_attempt: attemptId, p_results: results });
  return !error && Boolean((data as { ok: boolean } | null)?.ok);
}

/**
 * Musobaqa tugagan bo'lsa: yakunlanmagan urinishlarni baholaydi, o'rinlarni hisoblaydi, top-3 ga nishon beradi.
 * Natijalar sahifasi ochilganda chaqiriladi — idempotent.
 */
export async function finalizeIfEnded(contestId: number): Promise<void> {
  const admin = createSupabaseAdmin();
  const { data: c } = await admin.from("contests").select("id, title, ends_at, finalized").eq("id", contestId)
    .maybeSingle<{ id: number; title: string; ends_at: string; finalized: boolean }>();
  if (!c || c.finalized || Date.parse(c.ends_at) > Date.now()) return;

  const { data: ungraded } = await admin.from("contest_entries").select("attempt_id").eq("contest_id", contestId)
    .is("correct", null).returns<{ attempt_id: string }[]>();
  for (const e of ungraded ?? []) await gradeContestAttempt(e.attempt_id);

  const { data } = await admin.rpc("finalize_contest", { p_contest: contestId });
  if (!(data as { ok: boolean; already?: boolean } | null)?.ok || (data as { already?: boolean }).already) return;

  const { data: top } = await admin.from("contest_entries").select("user_id, rank, correct").eq("contest_id", contestId).lte("rank", 3)
    .returns<{ user_id: string; rank: number; correct: number }[]>();
  for (const t of top ?? []) {
    await awardBadges(t.user_id);
    await notifyUser(t.user_id, `🏆 <b>${esc(c.title)}</b>\n\nSiz <b>${t.rank}-o'rin</b>ni egalladingiz (${t.correct} ta to'g'ri javob)!`, {
      text: "Natijalar",
      path: `/app/musobaqa/${contestId}`,
    });
  }
}

/** Yangi nishonlarni beradi va botga xabar yuboradi. Hech qachon xato tashlamaydi. */
export async function awardBadges(userId: string): Promise<void> {
  try {
    const admin = createSupabaseAdmin();
    const { data } = await admin.rpc("award_badges", { p_user: userId });
    const codes = (data ?? []) as string[];
    if (!codes.length) return;
    const { data: badges } = await admin.from("badges").select("code, title, icon").in("code", codes).returns<{ code: string; title: string; icon: string }[]>();
    const lines = (badges ?? []).map((b) => `${b.icon} <b>${esc(b.title)}</b>`).join("\n");
    await notifyUser(userId, `Yangi nishon${codes.length > 1 ? "lar" : ""}! 🎉\n\n${lines}`, { text: "Nishonlarim", path: "/app/profil" });
  } catch (e) {
    console.error("awardBadges", (e as Error).message);
  }
}
