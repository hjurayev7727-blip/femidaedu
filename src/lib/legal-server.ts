import "server-only";
import { randomUUID } from "node:crypto";
import { analyzeDocument, docTriage, legalAnswer, type Attachment, type TutorTurn } from "@/lib/ai";
import { aiClient, logUsage, type AiResult } from "@/lib/ai-server";
import {
  checkDoc, DOC_EXT, DOC_FREE_WEEKLY, DOC_MAX_SOURCES, DOC_PREMIUM_WEEKLY, filterCitations, ownsDocPath,
  type Confidence, type DocMeta,
} from "@/lib/legal";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sourceRef, threadTitle, TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY } from "@/lib/tutor";
import { findSources } from "@/lib/tutor-server";

export const LEGAL_BUCKET = "legal-uploads";

const FAIL = {
  unavailable: "AI yordamchi hozircha ulanmagan.",
  error: "AI javob bera olmadi. Birozdan keyin urinib ko'ring.",
  refusal: "AI bu savolga javob bermadi. Savolni boshqacha yozib ko'ring.",
  saved: "Saqlab bo'lmadi.",
};

export type LegalReply = {
  threadId: string;
  answer: string;
  confidence: Confidence;
  needsLawyer: boolean;
  sources: { id: number; ref: string; field: string | null }[];
};

const FIELD_RE = /^[a-z-]{2,40}$/;

/** Huquqiy savol: yangi suhbat yoki davomi. AI yordamchi haftalik limitidan; xatoda qaytariladi. */
export async function askLegal(userId: string, premium: boolean, opts: { threadId: string | null; question: string }): Promise<AiResult<LegalReply>> {
  const c = aiClient();
  if (!c) return { ok: false, message: FAIL.unavailable };
  const admin = createSupabaseAdmin();

  let history: TutorTurn[] = [];
  if (opts.threadId) {
    const { data: t } = await admin.from("tutor_threads").select("id, user_id, mode").eq("id", opts.threadId)
      .maybeSingle<{ id: string; user_id: string; mode: string }>();
    if (!t || t.user_id !== userId || t.mode !== "legal") return { ok: false, message: "Suhbat topilmadi." };
    const { data: msgs } = await admin.from("tutor_messages").select("role, content").eq("thread_id", t.id).order("id", { ascending: false }).limit(6)
      .returns<TutorTurn[]>();
    history = (msgs ?? []).reverse();
  }

  const { data: used } = await admin.rpc("consume_tutor_quota", { p_user: userId, p_limit: premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY });
  if (used == null) {
    return { ok: false, message: premium ? "Haftalik savollar limiti tugadi." : `Bu haftalik bepul limit (${TUTOR_FREE_WEEKLY} ta savol) tugadi. Premium bilan ko'proq.` };
  }

  // Davomli suhbatda oldingi savol ham qidiruvga qo'shiladi (masalan: "bu holatda-chi?")
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content;
  const sources = await findSources(opts.question, null, { queries: lastUser ? [lastUser] : [] });
  const refs = sources.map(sourceRef);
  const r = await legalAnswer(c, { history, question: opts.question, sources: sources.map((s, i) => ({ ref: refs[i], title: s.title, body: s.body })) });
  if (!r.ok) {
    await admin.rpc("refund_tutor_quota", { p_user: userId });
    return { ok: false, message: r.reason === "refusal" ? FAIL.refusal : FAIL.error };
  }
  await logUsage(userId, "legal", r.usage);

  const cited = filterCitations(r.data.cited_refs, refs, r.data.confidence);
  // Faqat javobda ishlatilgan manbalar ko'rsatiladi; havola bo'lmasa — topilganlarning hammasi
  const shown = cited.refs.length ? sources.filter((_, i) => cited.refs.includes(refs[i])) : sources;
  const field = r.data.field && FIELD_RE.test(r.data.field) ? r.data.field : null;

  let threadId = opts.threadId;
  if (!threadId) {
    const { data: t, error } = await admin.from("tutor_threads").insert({ user_id: userId, mode: "legal", title: threadTitle(opts.question), field })
      .select("id").single<{ id: string }>();
    if (error || !t) return { ok: false, message: FAIL.saved };
    threadId = t.id;
  } else {
    await admin.from("tutor_threads").update(field ? { field } : { mode: "legal" }).eq("id", threadId); // updated_at yangilanadi
  }
  await admin.from("tutor_messages").insert([
    { thread_id: threadId, role: "user", content: opts.question.slice(0, 3000) },
    {
      thread_id: threadId, role: "assistant", content: r.data.answer.slice(0, 12000), article_ids: shown.map((s) => s.id),
      confidence: cited.confidence, needs_lawyer: r.data.needs_lawyer,
    },
  ]);
  return {
    ok: true,
    value: {
      threadId, answer: r.data.answer, confidence: cited.confidence, needsLawyer: r.data.needs_lawyer,
      sources: shown.map((s) => ({ id: s.id, ref: sourceRef(s), field: s.field_slug })),
    },
  };
}

/** Imzolangan yuklash havolasi: fayl to'g'ridan-to'g'ri Supabase Storage'ga (Vercel so'rov hajmi chegarasidan tashqari) */
export async function createDocUpload(userId: string, mime: string): Promise<AiResult<{ path: string; token: string }>> {
  const ext = DOC_EXT[mime];
  if (!ext) return { ok: false, message: "Faqat PDF yoki rasm (JPG, PNG, WEBP)." };
  const path = `${userId}/${randomUUID()}.${ext}`;
  const { data, error } = await createSupabaseAdmin().storage.from(LEGAL_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: "Yuklashni boshlab bo'lmadi." };
  return { ok: true, value: { path, token: data.token } };
}

export type DocReply = { threadId: string };

/** Yuklangan hujjat tahlili: tekshiruv → turini aniqlash → manbalar → tahlil. Fayl har holda o'chiriladi. */
export async function analyzeLegalDocument(
  userId: string, premium: boolean, opts: { path: string; name: string; question: string },
): Promise<AiResult<DocReply>> {
  if (!ownsDocPath(opts.path, userId)) return { ok: false, message: "Fayl topilmadi." };
  const admin = createSupabaseAdmin();
  const storage = admin.storage.from(LEGAL_BUCKET);
  try {
    const c = aiClient();
    if (!c) return { ok: false, message: FAIL.unavailable };
    const { data: blob, error } = await storage.download(opts.path);
    if (error || !blob) return { ok: false, message: "Fayl topilmadi. Qayta yuklang." };
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const check = checkDoc(bytes);
    if (!check.ok) return check;

    const { data: used } = await admin.rpc("consume_doc_quota", { p_user: userId, p_limit: premium ? DOC_PREMIUM_WEEKLY : DOC_FREE_WEEKLY });
    if (used == null) {
      return { ok: false, message: premium ? "Haftalik hujjat tahlili limiti tugadi." : `Bu haftalik bepul limit (${DOC_FREE_WEEKLY} ta hujjat) tugadi. Premium bilan ko'proq.` };
    }
    const data = Buffer.from(bytes).toString("base64");
    const attachment: Attachment = check.kind.ext === "pdf"
      ? { kind: "pdf", data }
      : { kind: "image", mediaType: check.kind.mime as "image/jpeg" | "image/png" | "image/webp", data };

    const refund = async (reason: string) => {
      await admin.rpc("refund_doc_quota", { p_user: userId });
      return { ok: false as const, message: reason === "refusal" ? FAIL.refusal : FAIL.error };
    };
    const tri = await docTriage(c, attachment);
    if (!tri.ok) return refund(tri.reason);
    await logUsage(userId, "document_triage", tri.usage);
    if (!tri.data.is_legal_doc) {
      await admin.rpc("refund_doc_quota", { p_user: userId });
      return { ok: false, message: "Bu fayl huquqiy hujjatga o'xshamaydi (shartnoma, ariza, da'vo, ishonchnoma…)." };
    }

    const sources = await findSources(`${tri.data.doc_type} ${opts.question}`, null, { queries: tri.data.search_queries.slice(0, 4), max: DOC_MAX_SOURCES });
    const refs = sources.map(sourceRef);
    const r = await analyzeDocument(c, {
      attachment, docType: tri.data.doc_type, question: opts.question,
      sources: sources.map((s, i) => ({ ref: refs[i], title: s.title, body: s.body })),
    });
    if (!r.ok) return refund(r.reason);
    await logUsage(userId, "document", r.usage);

    const cited = filterCitations(r.data.cited_refs, refs, r.data.confidence);
    const shown = cited.refs.length ? sources.filter((_, i) => cited.refs.includes(refs[i])) : sources;
    const field = tri.data.field && FIELD_RE.test(tri.data.field) ? tri.data.field : null;
    const meta: DocMeta = { type: check.kind.ext === "pdf" ? "pdf" : "image", pages: check.pages, name: opts.name };
    const body = [
      `Hujjat: ${tri.data.doc_type}`,
      r.data.summary,
      r.data.risks.length ? `Diqqat qiling:\n${r.data.risks.map((x) => `- ${x}`).join("\n")}` : "",
      r.data.missing.length ? `Hujjatda yo'q, lekin odatda bo'ladigan shartlar:\n${r.data.missing.map((x) => `- ${x}`).join("\n")}` : "",
      r.data.answer,
    ].filter(Boolean).join("\n\n");

    const { data: t, error: te } = await admin.from("tutor_threads")
      .insert({ user_id: userId, mode: "document", title: threadTitle(`${tri.data.doc_type}: ${opts.name}`), field })
      .select("id").single<{ id: string }>();
    if (te || !t) return { ok: false, message: FAIL.saved };
    await admin.from("tutor_messages").insert([
      { thread_id: t.id, role: "user", content: (opts.question.trim() || "Hujjatni tekshirib bering.").slice(0, 3000), doc_meta: meta },
      {
        thread_id: t.id, role: "assistant", content: body.slice(0, 12000), article_ids: shown.map((s) => s.id),
        confidence: cited.confidence, needs_lawyer: r.data.needs_lawyer,
      },
    ]);
    return { ok: true, value: { threadId: t.id } };
  } finally {
    await storage.remove([opts.path]);
  }
}

/** Unutilgan yuklamalar (tahlil boshlanmagan) — cron orqali o'chiriladi */
export async function purgeStaleUploads(olderThanMs = 60 * 60 * 1000): Promise<number> {
  const storage = createSupabaseAdmin().storage.from(LEGAL_BUCKET);
  const cutoff = Date.now() - olderThanMs;
  let removed = 0;
  const { data: dirs } = await storage.list("", { limit: 1000 });
  for (const d of dirs ?? []) {
    if (d.id) continue; // papka emas
    const { data: files } = await storage.list(d.name, { limit: 1000 });
    const stale = (files ?? []).filter((f) => f.created_at && Date.parse(f.created_at) < cutoff).map((f) => `${d.name}/${f.name}`);
    if (stale.length) {
      await storage.remove(stale);
      removed += stale.length;
    }
  }
  return removed;
}

/** Yuristlar bo'limi yoqilganmi (admin sozlamasi; bo'lim tayyor bo'lguncha o'chiq) */
export async function lawyersEnabled(): Promise<boolean> {
  // Ilova menyusi har sahifada chaqiradi: maxfiy kalit yo'q yoki baza javob bermasa — bo'lim yopiq, sahifa yiqilmaydi
  try {
    const { data } = await createSupabaseAdmin().from("app_settings").select("value").eq("key", "lawyers_enabled").maybeSingle<{ value: unknown }>();
    return data?.value === true;
  } catch (e) {
    console.error("lawyersEnabled", e instanceof Error ? e.message : e);
    return false;
  }
}
