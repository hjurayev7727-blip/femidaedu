import "server-only";
import { describeAnswer, describeResponse, type Answer, type Payload, type QuestionType, type Response } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { toScript, type Script } from "@/lib/translit";

type Row = {
  id: number;
  type: QuestionType;
  stem: string;
  context: string | null;
  payload: Payload;
  answer: Answer;
  explanation: string | null;
  source_note: string | null;
};

export type ReviewAnswer = { question_id: number; response: Response; is_correct: boolean | null };

/**
 * Yakunlangan urinish savollari tahlili (to'g'ri javob + izoh). Faqat urinish egasi va
 * urinish yakunlangani tekshirilgandan keyin chaqirilsin — javoblar admin klient bilan o'qiladi.
 */
export async function ReviewList({
  ids,
  answers,
  script,
  labels,
}: {
  ids: number[];
  answers: ReviewAnswer[];
  script: Script;
  /** topshiriq yorliqlari (imtihon: "36a"), bo'lmasa tartib raqami */
  labels?: string[];
}) {
  const { data: rows } = await createSupabaseAdmin()
    .from("questions")
    .select("id, type, stem, context, payload, answer, explanation, source_note")
    .in("id", ids)
    .returns<Row[]>();

  const t = (s: string | null) => (s ? toScript(s, script) : s);
  const byId = new Map((rows ?? []).map((r) => [Number(r.id), r]));
  const ans = new Map(answers.map((a) => [Number(a.question_id), a]));

  return (
    <ol className="space-y-3">
      {ids.map((qid, i) => {
        const q = byId.get(qid);
        if (!q) return null;
        const a = ans.get(qid);
        const state = !a ? "skip" : a.is_correct ? "ok" : "no";
        return (
          <li key={qid} className={`card border-l-4 ${state === "ok" ? "border-l-ok" : state === "no" ? "border-l-no" : "border-l-line"}`}>
            <p className="text-xs font-bold text-mute">
              {labels?.[i] ?? i + 1}-savol · {state === "ok" ? "✓ to'g'ri" : state === "no" ? "✕ xato" : "javob berilmagan"}
            </p>
            {q.context && <p className="mt-2 text-sm text-mute">{t(q.context)}</p>}
            <p className="mt-1.5 font-bold leading-snug">{t(q.stem)}</p>
            {state !== "ok" && (
              <p className="mt-2 text-sm">
                <span className="text-mute">Sizning javobingiz: </span>
                <span className="font-semibold text-no">{t(describeResponse(q.type, q.payload, a?.response ?? null))}</span>
              </p>
            )}
            <p className="mt-1 text-sm">
              <span className="text-mute">To&apos;g&apos;ri javob: </span>
              <span className="font-semibold text-ok">{t(describeAnswer(q.type, q.payload, q.answer))}</span>
            </p>
            {q.explanation && <p className="mt-2 text-sm leading-relaxed">{t(q.explanation)}</p>}
            {q.source_note && <p className="mt-1.5 text-xs text-mute">📖 {t(q.source_note)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
