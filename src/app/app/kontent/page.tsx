import type { Metadata } from "next";
import Link from "next/link";
import { aiEnabled } from "@/lib/ai-server";
import { requireRole } from "@/lib/auth";
import { describeAnswer, type Answer, type Payload, type QuestionType } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { resolveReport, reviewQuestion } from "./actions";
import { GeneratorForm } from "./generator-form";

export const metadata: Metadata = { title: "Kontent" };
// AI savol generatori (server action) 1–2 daqiqa ishlashi mumkin
export const maxDuration = 300;

type Q = {
  id: number; type: QuestionType; stem: string; context: string | null; payload: Payload; answer: Answer;
  explanation: string | null; source_note: string | null; difficulty: number; source: string; created_at: string;
};
type Report = { id: number; message: string; created_at: string; questions: Q | null; profiles: { full_name: string } | null };

const Q_COLS = "id, type, stem, context, payload, answer, explanation, source_note, difficulty, source, created_at";

export default async function ContentPanel() {
  const { profile } = await requireRole("author", "reviewer", "admin");
  const admin = createSupabaseAdmin();
  const canGenerate = profile.role !== "reviewer";
  const canReview = profile.role !== "author";

  const [{ data: queue }, { data: reports }, { data: docs }, { data: counts }] = await Promise.all([
    admin.from("questions").select(Q_COLS).in("status", ["draft", "review"]).order("created_at").limit(30).returns<Q[]>(),
    admin.from("reports").select(`id, message, created_at, questions(${Q_COLS}), profiles!reports_user_id_fkey(full_name)`)
      .eq("status", "open").order("created_at").limit(30).returns<Report[]>(),
    admin.from("documents").select("id, number, short_title").order("number").returns<{ id: number; number: number; short_title: string }[]>(),
    admin.rpc("topic_question_counts"),
  ]);
  const { data: topicDocs } = await admin.from("topics").select("id, document_id").not("document_id", "is", null).returns<{ id: number; document_id: number }[]>();
  const countByTopic = new Map(((counts ?? []) as { topic_id: number; total: number }[]).map((c) => [c.topic_id, Number(c.total)]));
  const countByDoc = new Map((topicDocs ?? []).map((t) => [t.document_id, countByTopic.get(t.id) ?? 0]));

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Kontent paneli</h1>
        <p className="mt-1 text-mute">Qoralamalar: {queue?.length ?? 0} · ochiq shikoyatlar: {reports?.length ?? 0}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/app/kontent/savollar" className="btn-ghost px-4! py-2! text-sm!">Barcha savollar</Link>
          <Link href="/app/kontent/savollar?filtr=uzun" className="btn-ghost px-4! py-2! text-sm!">⚠ Javobi ko&apos;zga tashlanadiganlar</Link>
        </div>
      </div>

      {canGenerate && (aiEnabled() ? (
        <GeneratorForm documents={(docs ?? []).map((d) => ({ number: d.number, short_title: d.short_title, count: countByDoc.get(d.id) ?? 0 }))} />
      ) : (
        <p className="card text-sm text-mute">AI generator uchun serverda <code>ANTHROPIC_API_KEY</code> sozlanmagan.</p>
      ))}

      <section className="space-y-3">
        <h2 className="text-lg font-extrabold">Ko&apos;rib chiqish navbati</h2>
        {!queue?.length && <p className="text-sm text-mute">Navbat bo&apos;sh.</p>}
        {(queue ?? []).map((q) => (
          <article key={q.id} className="card space-y-2">
            <QuestionPreview q={q} />
            <Link href={`/app/kontent/savollar/${q.id}`} className="text-xs font-bold text-cyan-2">Tahrirlash →</Link>
            {canReview && (
              <div className="flex gap-2 pt-1">
                <form action={reviewQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="decision" value="publish" />
                  <button className="btn-primary px-4! py-2! text-sm!">✓ E&apos;lon qilish</button>
                </form>
                <form action={reviewQuestion}>
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="decision" value="reject" />
                  <button className="btn-ghost px-4! py-2! text-sm! text-no!">Rad etish</button>
                </form>
              </div>
            )}
          </article>
        ))}
      </section>

      {canReview && (
        <section className="space-y-3">
          <h2 className="text-lg font-extrabold">Shikoyatlar</h2>
          {!reports?.length && <p className="text-sm text-mute">Ochiq shikoyat yo&apos;q.</p>}
          {(reports ?? []).map((r) => (
            <article key={r.id} className="card space-y-2">
              <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm">
                <b>{r.profiles?.full_name || "O'quvchi"}:</b> {r.message}
              </p>
              {r.questions && <QuestionPreview q={r.questions} />}
              {r.questions && <Link href={`/app/kontent/savollar/${r.questions.id}`} className="text-xs font-bold text-cyan-2">Savolni tuzatish →</Link>}
              <div className="flex gap-2 pt-1">
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value="accepted" />
                  <button className="btn-primary px-4! py-2! text-sm!">To&apos;g&apos;ri — savolni muomaladan olish</button>
                </form>
                <form action={resolveReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="decision" value="rejected" />
                  <button className="btn-ghost px-4! py-2! text-sm!">Savol to&apos;g&apos;ri</button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function QuestionPreview({ q }: { q: Q }) {
  const options = "options" in q.payload ? q.payload.options : null;
  const correct = "index" in q.answer ? q.answer.index : -1;
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-mute">
        #{q.id} · {q.type} · qiyinlik {q.difficulty} · {q.source === "ai" ? "🤖 AI qoralama" : q.source}
      </p>
      {q.context && <p className="rounded-xl bg-amber-soft px-3 py-2 text-sm">{q.context}</p>}
      <p className="font-bold leading-snug">{q.stem}</p>
      {options ? (
        <ol className="space-y-1 text-sm">
          {options.map((o, i) => (
            <li key={i} className={i === correct ? "font-bold text-ok" : ""}>{String.fromCharCode(65 + i)}) {o}{i === correct && " ✓"}</li>
          ))}
        </ol>
      ) : (
        <p className="text-sm">To&apos;g&apos;ri javob: <b className="text-ok">{describeAnswer(q.type, q.payload, q.answer)}</b></p>
      )}
      {q.explanation && <p className="text-sm text-mute">{q.explanation}</p>}
      {q.source_note && <p className="text-xs text-mute">📖 {q.source_note}</p>}
    </div>
  );
}
