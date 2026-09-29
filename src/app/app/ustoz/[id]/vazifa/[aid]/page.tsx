import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";

export const metadata: Metadata = { title: "Vazifa natijalari" };

type Row = { user_id: string; full_name: string; status: "new" | "started" | "done"; correct: number | null; total: number; score: number | null; finished_at: string | null };

const STATUS = { new: "Boshlamagan", started: "Jarayonda", done: "Bajardi" } as const;

export default async function AssignmentProgress({ params }: PageProps<"/app/ustoz/[id]/vazifa/[aid]">) {
  const { id, aid } = await params;
  const groupId = z.coerce.number().int().positive().safeParse(id);
  const assignmentId = z.coerce.number().int().positive().safeParse(aid);
  if (!groupId.success || !assignmentId.success) notFound();
  const { supabase } = await requireRole("teacher", "admin");

  const { data: a } = await supabase.from("assignments").select("id, title, group_id, question_count, topics(title)").eq("id", assignmentId.data)
    .eq("group_id", groupId.data).maybeSingle<{ id: number; title: string; question_count: number; topics: { title: string } | null }>();
  if (!a) notFound();
  const { data, error } = await supabase.rpc("assignment_progress", { p_assignment: a.id });
  if (error) notFound();
  const rows = (data ?? []) as Row[];
  const doneRows = rows.filter((r) => r.status === "done");
  const avg = doneRows.length ? Math.round(doneRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / doneRows.length) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href={`/app/ustoz/${groupId.data}`} className="text-sm font-bold text-mute hover:text-ink">← Guruh</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">{a.title}</h1>
        <p className="text-mute">
          {a.topics?.title} · {a.question_count} savol · bajardi {doneRows.length}/{rows.length}
          {avg != null && ` · o'rtacha ${avg}%`}
        </p>
      </div>
      <ul className="card divide-y divide-line p-0!">
        {rows.map((r) => (
          <li key={r.user_id} className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="font-semibold">{r.full_name || "Ismsiz"}</span>
            <span className="text-sm">
              {r.status === "done" ? (
                <b className={Number(r.score) >= 70 ? "text-ok" : Number(r.score) >= 50 ? "text-amber" : "text-no"}>
                  {Math.round(Number(r.score))}% · {r.correct}/{r.total}
                </b>
              ) : (
                <span className="text-mute">{STATUS[r.status]}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
