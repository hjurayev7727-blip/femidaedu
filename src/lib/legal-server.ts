import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeDocument, legalAnswer, triageDocument, type Attachment, type TutorTurn } from "@/lib/ai";
import { aiClient, logUsage, type AiResult } from "@/lib/ai-server";
import {
  DOC_EXT, DOC_FREE_WEEKLY, DOC_MAX_SOURCES, DOC_PREMIUM_WEEKLY, filterCitations, formatDocAnalysis, LEGAL_BUCKET, MAX_PDF_PAGES,
  pdfPageCount, safeFileName, sniffFile, UPLOAD_TTL_MS, uploadPathRe, UPLOADS_PER_HOUR, type Confidence, type DocMime, type LegalMode,
} from "@/lib/legal";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sourceRef, threadTitle, TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY, type SourceArticle } from "@/lib/tutor";
import { findSources } from "@/lib/tutor-server";
import { uzWeekStart } from "@/lib/user-tests";

const FAIL = {
  unavailable: "AI yordamchi hozircha ulanmagan.",
  error: "AI javob bera olmadi. Birozdan keyin urinib ko'ring.",
  refusal: "AI bu savolga javob bermadi. Savolni boshqacha yozib ko'ring.",
};
const questionLimit = (premium: boolean) =>
  premium ? "Haftalik savollar limiti tugadi." : `Bu haftalik bepul limit (${TUTOR_FREE_WEEKLY} ta savol) tugadi. Premium bilan ko'proq.`;
const docLimit = (premium: boolean) =>
  premium ? `Haftalik hujjat tahlili limiti (${DOC_PREMIUM_WEEKLY} ta) tugadi.` : `Bu haftalik bepul hujjat tahlili (${DOC_FREE_WEEKLY} ta) tugadi. Premium bilan ko'proq.`;

export type LegalSource = { id: number; ref: string; field: string | null };
export type LegalReply = {
  threadId: string;
  answer: string;
  confidence: Confidence;
  needsLawyer: boolean;
  sources: LegalSource[];
};

async function fieldSlugs(): Promise<string[]> {
  const { data } = await createSupabaseAdmin().from("fields").select("slug").order("sort").returns<{ slug: string }[]>();
  return (data ?? []).map((f) => f.slug);
}

/** Model ishlatgan manbalar birinchi, keyin qolganlari — havola chiplari uchun */
function citedFirst(sources: SourceArticle[], refs: string[]): LegalSource[] {
  const all = sources.map((s) => ({ id: s.id, ref: sourceRef(s), field: s.field_slug }));
  return [...all.filter((s) => refs.includes(s.ref)), ...all.filter((s) => !refs.includes(s.ref))];
}

async function saveTurn(
  userId: string, threadId: string | null,
  t: { mode: LegalMode; title: string; field: string | null; question: string; answer: string; sources: SourceArticle[]; confidence: Confidence; needsLawyer: boolean; docMeta?: object },
): Promise<string | null> {
  const admin = createSupabaseAdmin();
  let id = threadId;
  if (!id) {
    const { data, error } = await admin.from("tutor_threads").insert({ user_id: userId, mode: t.mode, title: t.title, field: t.field })
      .select("id").single<{ id: string }>();
    if (error || !data) return null;
    id = data.id;
  } else {
    await admin.from("tutor_threads").update({ field: t.field }).eq("id", id); // updated_at yangilanadi
  }
  await admin.from("tutor_messages").insert([
    { thread_id: id, role: "user", content: t.question.slice(0, 3000), doc_meta: t.docMeta ?? null },
    {
      thread_id: id, role: "assistant", content: t.answer.slice(0, 12000), article_ids: t.sources.map((s) => s.id),
      confidence: t.confidence, needs_lawyer: t.needsLawyer,
    },
  ]);
  return id;
}

/** Huquqiy savol: yangi suhbat yoki davomi (hujjat suhbatining davomi ham shu yerda). Limit — AI yordamchi bilan umumiy. */
export async function askLegal(userId: string, premium: boolean, opts: { threadId: string | null; question: string }): Promise<AiResult<LegalReply>> {
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL.unavailable };
  const admin = createSupabaseAdmin();

  let mode: LegalMode = "legal";
  let history: TutorTurn[] = [];
  let prevField: string | null = null;
  if (opts.threadId) {
    const { data: t } = await admin.from("tutor_threads").select("id, user_id, mode, field").eq("id", opts.threadId)
      .maybeSingle<{ id: string; user_id: string; mode: string; field: string | null }>();
    if (!t || t.user_id !== userId || (t.mode !== "legal" && t.mode !== "document")) return { ok: false, message: "Suhbat topilmadi." };
    mode = t.mode;
    prevField = t.field;
    const { data: msgs } = await admin.from("tutor_messages").select("role, content").eq("thread_id", t.id).order("id", { ascending: false }).limit(8)
      .returns<TutorTurn[]>();
    history = (msgs ?? []).reverse();
  }

  const { data: used } = await admin.rpc("consume_tutor_quota", { p_user: userId, p_limit: premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY });
  if (used == null) return { ok: false, message: questionLimit(premium) };

  // Davomida oldingi savol ham qidiruvga qo'shiladi ("bunda muddat qancha?" kabi qisqa savollar uchun)
  const lastUser = [...history].reverse().find((h) => h.role === "user")?.content ?? "";
  const [sources, fields] = await Promise.all([findSources(opts.question, null, lastUser ? [lastUser.slice(0, 300)] : []), fieldSlugs()]);
  const r = await legalAnswer(c, {
    history, question: opts.question, fields,
    sources: sources.map((s) => ({ ref: sourceRef(s), title: s.title, body: s.body })),
  });
  if (!r.ok) {
    await admin.rpc("refund_tutor_quota", { p_user: userId });
    return { ok: false, message: r.reason === "refusal" ? FAIL.refusal : FAIL.error };
  }
  await logUsage(userId, "legal_qa", r.usage);

  const cited = filterCitations(r.data.cited_refs, sources.map(sourceRef), r.data.confidence);
  const field = fields.includes(r.data.field) ? r.data.field : prevField;
  const threadId = await saveTurn(userId, opts.threadId, {
    mode, title: threadTitle(opts.question), field, question: opts.question, answer: r.data.answer, sources,
    confidence: cited.confidence, needsLawyer: r.data.needs_lawyer,
  });
  if (!threadId) return { ok: false, message: "Saqlab bo'lmadi." };
  return {
    ok: true,
    value: { threadId, answer: r.data.answer, confidence: cited.confidence, needsLawyer: r.data.needs_lawyer, sources: citedFirst(sources, cited.refs) },
  };
}

/** Bir martalik yuklash havolasi: fayl brauzerdan to'g'ridan-to'g'ri yopiq bucket'ga (server action tana chegarasidan o'tmaydi) */
export async function createLegalUpload(userId: string, premium: boolean, mime: DocMime): Promise<AiResult<{ path: string; token: string }>> {
  const admin = createSupabaseAdmin();
  const { data: week } = await admin.from("ai_weekly").select("docs").eq("user_id", userId).eq("week", uzWeekStart()).maybeSingle<{ docs: number }>();
  if ((week?.docs ?? 0) >= (premium ? DOC_PREMIUM_WEEKLY : DOC_FREE_WEEKLY)) return { ok: false, message: docLimit(premium) };
  const since = new Date(Date.now() - UPLOAD_TTL_MS).toISOString();
  const { count } = await admin.from("legal_uploads").select("path", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
  if ((count ?? 0) >= UPLOADS_PER_HOUR) return { ok: false, message: "Juda ko'p yuklash. Birozdan keyin urinib ko'ring." };

  const path = `${userId}/${randomUUID()}.${DOC_EXT[mime]}`;
  const { error } = await admin.from("legal_uploads").insert({ path, user_id: userId });
  if (error) return { ok: false, message: "Serverda xatolik. Qayta urinib ko'ring." };
  const { data, error: e2 } = await admin.storage.from(LEGAL_BUCKET).createSignedUploadUrl(path);
  if (e2 || !data) {
    await admin.from("legal_uploads").delete().eq("path", path);
    console.error("legal upload url", e2?.message);
    return { ok: false, message: "Yuklash havolasini olib bo'lmadi." };
  }
  return { ok: true, value: { path, token: data.token } };
}

async function removeUpload(path: string) {
  const admin = createSupabaseAdmin();
  await admin.storage.from(LEGAL_BUCKET).remove([path]);
  await admin.from("legal_uploads").delete().eq("path", path);
}

/**
 * Hujjat tahlili: saralash (huquqiy hujjatmi, qaysi soha, qidiruv so'rovlari) → manba moddalar → tahlil.
 * Fayl har qanday natijada o'chiriladi; bazada faqat savol, javob va fayl haqida qisqa ma'lumot qoladi.
 */
export async function analyzeLegalDocument(
  userId: string, premium: boolean, opts: { path: string; question: string; name: string },
): Promise<AiResult<LegalReply>> {
  if (!uploadPathRe(userId).test(opts.path)) return { ok: false, message: "Fayl topilmadi." };
  const admin = createSupabaseAdmin();
  const { data: issued } = await admin.from("legal_uploads").select("path").eq("path", opts.path).eq("user_id", userId).maybeSingle();
  if (!issued) return { ok: false, message: "Fayl topilmadi. Qayta yuklang." };
  try {
    const c = aiClient();
    if (!c) return { ok: false, message: FAIL.unavailable };
    const { data: blob, error } = await admin.storage.from(LEGAL_BUCKET).download(opts.path);
    if (error || !blob) return { ok: false, message: "Fayl yuklanmagan. Qayta urinib ko'ring." };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const sniff = sniffFile(bytes);
    if (!sniff.ok) return { ok: false, message: sniff.message };
    const pages = sniff.kind.ext === "pdf" ? pdfPageCount(bytes) : 1;
    if (pages > MAX_PDF_PAGES) return { ok: false, message: `PDF ${MAX_PDF_PAGES} sahifadan oshmasin (bu faylda ${pages} ta).` };

    const { data: used } = await admin.rpc("consume_doc_quota", { p_user: userId, p_limit: premium ? DOC_PREMIUM_WEEKLY : DOC_FREE_WEEKLY });
    if (used == null) return { ok: false, message: docLimit(premium) };
    const refund = () => admin.rpc("refund_doc_quota", { p_user: userId });

    const data = Buffer.from(bytes).toString("base64");
    const attachment: Attachment = sniff.kind.ext === "pdf" ? { kind: "pdf", data } : { kind: "image", mediaType: sniff.kind.mime as "image/jpeg", data };
    const fields = await fieldSlugs();
    const tri = await triageDocument(c, { attachment, question: opts.question, fields });
    if (!tri.ok) {
      await refund();
      return { ok: false, message: tri.reason === "refusal" ? FAIL.refusal : FAIL.error };
    }
    await logUsage(userId, "legal_doc_triage", tri.usage);
    if (!tri.data.is_legal_doc) {
      await refund();
      return { ok: false, message: "Bu huquqiy hujjatga o'xshamaydi. Shartnoma, ariza, da'vo yoki shunga o'xshash hujjat yuklang." };
    }

    const sources = await findSources(`${tri.data.doc_type} ${opts.question}`, null, tri.data.search_queries, DOC_MAX_SOURCES);
    const r = await analyzeDocument(c, {
      attachment, docType: tri.data.doc_type, question: opts.question, fields,
      sources: sources.map((s) => ({ ref: sourceRef(s), title: s.title, body: s.body })),
    });
    if (!r.ok) {
      await refund();
      return { ok: false, message: r.reason === "refusal" ? FAIL.refusal : FAIL.error };
    }
    await logUsage(userId, "legal_doc", r.usage);

    const cited = filterCitations(r.data.cited_refs, sources.map(sourceRef), r.data.confidence);
    const answer = formatDocAnalysis(r.data);
    const name = safeFileName(opts.name);
    const field = fields.includes(tri.data.field) ? tri.data.field : null;
    const question = opts.question.trim() || "Hujjatni tahlil qiling: nimaga e'tibor berishim kerak?";
    const threadId = await saveTurn(userId, null, {
      mode: "document", title: threadTitle(`${tri.data.doc_type || "Hujjat"}: ${name}`), field, question, answer, sources,
      confidence: cited.confidence, needsLawyer: r.data.needs_lawyer,
      docMeta: { type: tri.data.doc_type.slice(0, 120), pages, name, mime: sniff.kind.mime },
    });
    if (!threadId) return { ok: false, message: "Saqlab bo'lmadi." };
    return { ok: true, value: { threadId, answer, confidence: cited.confidence, needsLawyer: r.data.needs_lawyer, sources: citedFirst(sources, cited.refs) } };
  } finally {
    await removeUpload(opts.path);
  }
}

/** Cron: tahlil qilinmagan (tashlab ketilgan) fayllarni o'chirish */
export async function cleanupLegalUploads(): Promise<number> {
  const admin = createSupabaseAdmin();
  const before = new Date(Date.now() - UPLOAD_TTL_MS).toISOString();
  const { data } = await admin.from("legal_uploads").select("path").lt("created_at", before).limit(1000).returns<{ path: string }[]>();
  const paths = (data ?? []).map((r) => r.path);
  if (!paths.length) return 0;
  await admin.storage.from(LEGAL_BUCKET).remove(paths);
  await admin.from("legal_uploads").delete().in("path", paths);
  return paths.length;
}

/** Yuristlar bo'limi (4–5-bosqich) yoqilganmi: app_settings.lawyers_enabled = true */
export async function lawyersEnabled(): Promise<boolean> {
  const { data } = await createSupabaseAdmin().from("app_settings").select("value").eq("key", "lawyers_enabled").maybeSingle<{ value: unknown }>();
  return data?.value === true;
}
