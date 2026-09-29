"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateAndSave, type GenerateReport } from "@/lib/ai-server";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type GenState = { ok: true; report: GenerateReport } | { ok: false; message: string } | null;

const GenInput = z.object({
  doc: z.coerce.number().int().min(1).max(52),
  source: z.string().trim().min(200, "Manba matni kamida 200 belgi bo'lsin (qonun moddalarini joylashtiring)").max(60_000, "Manba matni 60 000 belgidan oshmasin"),
  count: z.coerce.number().int().min(3).max(10),
  types: z.array(z.enum(["single", "fill_blank", "case", "open"])).min(1, "Kamida bitta savol turini tanlang"),
});

export async function generateQuestions(_prev: GenState, form: FormData): Promise<GenState> {
  const { userId } = await requireRole("author", "admin");
  const input = GenInput.safeParse({
    doc: form.get("doc"),
    source: form.get("source"),
    count: form.get("count"),
    types: form.getAll("types"),
  });
  if (!input.success) return { ok: false, message: input.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  const r = await generateAndSave(userId, { documentNumber: input.data.doc, sourceText: input.data.source, count: input.data.count, types: input.data.types });
  if (!r.ok) return { ok: false, message: r.message };
  revalidatePath("/app/kontent");
  return { ok: true, report: r.value };
}

export async function reviewQuestion(form: FormData) {
  const { userId } = await requireRole("reviewer", "admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const decision = z.enum(["publish", "reject"]).parse(form.get("decision"));
  await createSupabaseAdmin()
    .from("questions")
    .update({ status: decision === "publish" ? "published" : "archived", reviewer_id: userId })
    .eq("id", id)
    .in("status", ["draft", "review"]);
  revalidatePath("/app/kontent");
}

export async function resolveReport(form: FormData) {
  await requireRole("reviewer", "admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const decision = z.enum(["accepted", "rejected"]).parse(form.get("decision"));
  const admin = createSupabaseAdmin();
  const { data: rep } = await admin.from("reports").update({ status: decision }).eq("id", id).eq("status", "open").select("question_id").maybeSingle<{ question_id: number }>();
  // Shikoyat to'g'ri bo'lsa — savol tuzatilguncha muomaladan olinadi (ko'rib chiqish navbatiga qaytadi)
  if (rep && decision === "accepted") {
    await admin.from("questions").update({ status: "review" }).eq("id", rep.question_id).eq("status", "published");
  }
  revalidatePath("/app/kontent");
}
