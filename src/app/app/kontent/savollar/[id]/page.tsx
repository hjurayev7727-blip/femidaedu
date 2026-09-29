import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import type { Answer, Payload, QuestionType } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { QuestionEditor, type EditableQuestion } from "./editor";

export const metadata: Metadata = { title: "Savolni tahrirlash" };

type Row = {
  id: number; type: QuestionType; stem: string; context: string | null; payload: Payload; answer: Answer; explanation: string | null;
  source_note: string | null; difficulty: number; status: string; version: number; source: string; irt_b: number | null;
  documents: { number: number; short_title: string } | null;
};

export default async function EditQuestion({ params }: PageProps<"/app/kontent/savollar/[id]">) {
  const { id: raw } = await params;
  const id = z.coerce.number().int().positive().safeParse(raw);
  if (!id.success) notFound();
  const { profile } = await requireRole("author", "reviewer", "admin");
  const admin = createSupabaseAdmin();
  const [{ data: q }, { data: stats }, { data: reports }] = await Promise.all([
    admin.from("questions")
      .select("id, type, stem, context, payload, answer, explanation, source_note, difficulty, status, version, source, irt_b, documents(number, short_title)")
      .eq("id", id.data).maybeSingle<Row>(),
    admin.from("attempt_answers").select("is_correct").eq("question_id", id.data).not("is_correct", "is", null).limit(5000).returns<{ is_correct: boolean }[]>(),
    admin.from("reports").select("id, message, status, created_at").eq("question_id", id.data).order("created_at", { ascending: false }).limit(10)
      .returns<{ id: number; message: string; status: string; created_at: string }[]>(),
  ]);
  if (!q) notFound();

  const p = q.payload as Record<string, unknown>;
  const a = q.answer as Record<string, unknown>;
  const editable: EditableQuestion = {
    id: q.id,
    version: q.version,
    type: q.type,
    stem: q.stem,
    context: q.context,
    options: Array.isArray(p.options) && typeof a.index === "number" ? (p.options as string[]) : null,
    statements: Array.isArray(p.statements) ? (p.statements as string[]) : null,
    correct: typeof a.index === "number" ? a.index : null,
    kind: q.type === "open" ? String(p.kind) : null,
    accepted: Array.isArray(a.accepted) ? (a.accepted as string[]) : null,
    show: typeof a.show === "string" ? a.show : null,
    explanation: q.explanation,
    source_note: q.source_note,
    difficulty: q.difficulty,
    status: q.status,
    readonlyStructure:
      q.type === "matching" || q.type === "ordering" || q.type === "multi"
        ? "Moslashtirish/tartiblash tuzilmasi bu yerda tahrirlanmaydi — matn, izoh, qiyinlik va holatni o'zgartirish mumkin."
        : null,
  };
  const answered = stats?.length ?? 0;
  const pct = answered ? Math.round((100 * (stats ?? []).filter((s) => s.is_correct).length) / answered) : null;
  const canEdit = profile.role !== "author";

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/app/kontent/savollar" className="text-sm font-bold text-mute hover:text-ink">← Savollar</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Savol #{q.id}</h1>
        <p className="text-sm text-mute">
          {q.documents ? `№${q.documents.number} ${q.documents.short_title}` : "Darslik"} · {q.type} · manba: {q.source} · v{q.version}
          {answered > 0 && ` · ${answered} javob, ${pct}% to'g'ri`}
          {q.irt_b != null && ` · Rasch b = ${Number(q.irt_b).toFixed(2)}`}
        </p>
      </div>

      {(reports ?? []).length > 0 && (
        <section className="card space-y-1.5">
          <h2 className="text-sm font-extrabold">Shikoyatlar</h2>
          {reports!.map((r) => (
            <p key={r.id} className="text-sm"><span className="text-mute">[{r.status}]</span> {r.message}</p>
          ))}
        </section>
      )}

      {canEdit ? (
        <QuestionEditor q={editable} />
      ) : (
        <p className="card text-sm text-mute">Tahrirlash — ekspert (reviewer) yoki admin uchun.</p>
      )}
    </div>
  );
}
