import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { generateTestDrafts, moderateTest, type Attachment, type Draft } from "@/lib/ai";
import { aiClient, logUsage, type AiResult } from "@/lib/ai-server";
import { gradeResponse, type Answer, type ClientQuestion, type Payload, type QuestionType, type Response } from "@/lib/questions";
import { createSupabase, createSupabaseAdmin } from "@/lib/supabase/server";
import {
  chunkCounts, draftToItem, FREE_MAX_ITEMS, FREE_WEEKLY_TESTS, inputToRow, MAX_ITEMS, MIN_ITEMS, PREMIUM_WEEKLY_TESTS,
  SettingsSchema, type ItemRow, type Reveal, type TestSettings, type Visibility,
} from "@/lib/user-tests";

// ─────────────────────────── Ishlovchi: foydalanuvchi yoki mehmon ───────────────────────────

const GUEST_COOKIE = "fe_guest";
export type Actor = { userId: string | null; guest: string | null };

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Joriy ishlovchi: kirgan foydalanuvchi yoki mehmon tokeni xeshi (token faqat httpOnly cookie'da) */
export async function currentActor(): Promise<Actor> {
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (userId) return { userId, guest: null };
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  return { userId: null, guest: token && /^[a-f0-9]{48}$/.test(token) ? hashToken(token) : null };
}

/** Mehmon tokeni (server action ichida — cookie yoziladi) */
export async function ensureGuest(): Promise<string> {
  const store = await cookies();
  let token = store.get(GUEST_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{48}$/.test(token)) {
    token = randomBytes(24).toString("hex");
    const secure = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");
    store.set(GUEST_COOKIE, token, {
      httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 365,
      ...(secure ? { sameSite: "none" as const, secure: true, partitioned: true } : { sameSite: "lax" as const }),
    });
  }
  return hashToken(token);
}

/** Kirgandan keyin: mehmon sifatidagi urinishlar akkauntga o'tadi */
export async function claimGuestAttempts(userId: string) {
  const token = (await cookies()).get(GUEST_COOKIE)?.value;
  if (!token) return 0;
  const { data } = await createSupabaseAdmin().rpc("claim_guest_attempts", { p_user: userId, p_guest: hashToken(token) });
  return Number(data ?? 0);
}

// ─────────────────────────── AI bilan yaratish ───────────────────────────

export type TestSource =
  | { kind: "articles"; articleIds: number[] }
  | { kind: "chapter"; chapterId: number }
  | { kind: "text"; text: string; documentId: number | null }
  | { kind: "file"; attachment: Attachment; note: string; documentId: number | null };

export type CreateInput = {
  title: string;
  field: string | null;
  source: TestSource;
  count: number;
  types: Draft["type"][];
};

type ArticleRow = { id: number; number: string; title: string | null; body: string; document_id: number };

async function loadSource(src: TestSource) {
  const admin = createSupabaseAdmin();
  const cols = "id, number, title, body, document_id";
  let picked: ArticleRow[] = [];
  let documentId: number | null = null;
  if (src.kind === "articles") {
    const { data } = await admin.from("articles").select(cols).in("id", src.articleIds.slice(0, 40)).neq("status", "repealed").order("sort").returns<ArticleRow[]>();
    picked = data ?? [];
    documentId = picked[0]?.document_id ?? null;
  } else if (src.kind === "chapter") {
    const { data } = await admin.from("articles").select(cols).eq("chapter_id", src.chapterId).neq("status", "repealed").order("sort").limit(60).returns<ArticleRow[]>();
    picked = data ?? [];
    documentId = picked[0]?.document_id ?? null;
  } else {
    documentId = src.documentId;
  }
  const { data: doc } = documentId
    ? await admin.from("documents").select("short_title, fields(slug)").eq("id", documentId).maybeSingle<{ short_title: string; fields: { slug: string } | null }>()
    : { data: null };
  // Modda bog'lash uchun hujjatning barcha moddalari (raqam → id)
  const { data: all } = documentId
    ? await admin.from("articles").select("id, number").eq("document_id", documentId).neq("status", "repealed").returns<{ id: number; number: string }[]>()
    : { data: [] as { id: number; number: string }[] };

  const articlesText = picked.map((a) => `${a.number}-modda. ${a.title ?? ""}\n${a.body}`).join("\n\n");
  const sourceText = src.kind === "text" ? src.text : src.kind === "file" ? src.note : articlesText;
  return {
    title: doc?.short_title ?? "Foydalanuvchi materiali",
    field: doc?.fields?.slug ?? null,
    sourceText,
    attachment: src.kind === "file" ? src.attachment : null,
    articles: (all ?? []).map((a) => ({ id: Number(a.id), number: a.number })),
    empty: (src.kind === "articles" || src.kind === "chapter") && !picked.length,
  };
}

export type CreateReport = { id: number; code: string; created: number; rejected: number; ownMaterial: boolean };

/** AI test yaratadi (qoralama). Haftalik limit atomar; AI xatosida limit qaytariladi. */
export async function createAiTest(userId: string, premium: boolean, input: CreateInput): Promise<AiResult<CreateReport>> {
  const c = aiClient();
  if (!c) return { ok: false, message: "AI hozircha ulanmagan." };
  const max = premium ? MAX_ITEMS : FREE_MAX_ITEMS;
  if (input.count < MIN_ITEMS || input.count > max) {
    return { ok: false, message: premium ? `Savollar soni ${MIN_ITEMS}–${MAX_ITEMS} oralig'ida bo'lsin.` : `Bepul tarifda ${FREE_MAX_ITEMS} tagacha savol. Premium — ${MAX_ITEMS} tagacha.` };
  }
  const src = await loadSource(input.source);
  if (src.empty) return { ok: false, message: "Tanlangan moddalar topilmadi." };
  if (!src.sourceText.trim() && !src.attachment) return { ok: false, message: "Manba bo'sh." };

  const admin = createSupabaseAdmin();
  const { data: used } = await admin.rpc("consume_test_quota", { p_user: userId, p_limit: premium ? PREMIUM_WEEKLY_TESTS : FREE_WEEKLY_TESTS });
  if (used == null) {
    return { ok: false, message: premium ? "Haftalik AI test limiti tugadi." : `Bu haftalik bepul limit (${FREE_WEEKLY_TESTS} ta AI test) tugadi. Premium bilan ko'proq.` };
  }
  const refund = () => admin.rpc("refund_test_quota", { p_user: userId });

  const parts = chunkCounts(input.count);
  const results = await Promise.all(
    parts.map((n, i) => generateTestDrafts(c, {
      sourceTitle: src.title, sourceText: src.sourceText, attachment: src.attachment, count: n, types: input.types, part: [i + 1, parts.length],
    })),
  );
  const drafts: Draft[] = [];
  for (const r of results) {
    if (r.ok) {
      drafts.push(...r.data.questions);
      await logUsage(userId, "ugc_generate", r.usage);
    }
  }
  if (!results.some((r) => r.ok)) {
    // Limit faqat texnik xatoda qaytariladi; model javob bergan (rad etgan/bo'sh) holatlar limitdan olinadi
    if (results.every((r) => !r.ok && r.reason === "error")) await refund();
    const refusal = results.some((r) => !r.ok && r.reason === "refusal");
    return { ok: false, message: refusal ? "AI bu material bo'yicha test tuzmadi." : "AI javob bera olmadi. Birozdan keyin urinib ko'ring." };
  }

  let rejected = 0;
  const seen = new Set<string>();
  const items: ItemRow[] = [];
  for (const d of drafts) {
    const conv = draftToItem(d, src.title, src.articles);
    if (!conv.ok || seen.has(conv.item.fingerprint ?? "")) {
      rejected++;
      continue;
    }
    seen.add(conv.item.fingerprint ?? "");
    items.push(conv.item);
  }
  if (!items.length) {
    return { ok: false, message: "Materialdan huquqiy test tuzib bo'lmadi. Boshqa matn yoki moddalarni tanlang." };
  }

  const { data, error } = await admin.rpc("create_user_test", {
    p_user: userId,
    p: { title: input.title, field: input.field ?? src.field, source: "ai", items: items.slice(0, MAX_ITEMS) },
  });
  if (error || !data) {
    await refund();
    return { ok: false, message: "Saqlab bo'lmadi." };
  }
  const r = data as { id: number; share_code: string; items: number };
  return { ok: true, value: { id: r.id, code: r.share_code, created: r.items, rejected, ownMaterial: items.some((i) => i.article_id == null) } };
}

// ─────────────────────────── Muallif: tahrirlash, nashr ───────────────────────────

type StoredItem = { id: number; type: QuestionType; payload: Payload; answer: Answer };

/** Savolni saqlash. Javob kaliti o'zgarsa, barcha javoblar yangi kalit bilan qayta baholanadi (jimgina). */
export async function saveTestItem(userId: string, testId: number, itemId: number | null, raw: unknown): Promise<AiResult<{ id: number; regraded: boolean }>> {
  const conv = inputToRow(raw);
  if (!conv.ok) return { ok: false, message: conv.message };
  // Qayta baholash paytida yangi javob kelsa, SQL butunlay qaytaradi (regrade_retry) — javoblarni qayta o'qib urinamiz
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await saveTestItemOnce(userId, testId, itemId, conv.row);
    if (r !== "retry") return r;
  }
  return { ok: false, message: "Saqlab bo'lmadi — test hozir ishlanmoqda. Birozdan keyin urinib ko'ring." };
}

async function saveTestItemOnce(userId: string, testId: number, itemId: number | null, row: ItemRow): Promise<AiResult<{ id: number; regraded: boolean }> | "retry"> {
  const admin = createSupabaseAdmin();

  let regrade: { attempt_id: string; correct: boolean }[] = [];
  if (itemId) {
    const { data: old } = await admin.from("test_items").select("id, type, payload, answer, tests!inner(owner_id)").eq("id", itemId).eq("test_id", testId)
      .maybeSingle<StoredItem & { tests: { owner_id: string } }>();
    if (!old || old.tests.owner_id !== userId) return { ok: false, message: "Savol topilmadi." };
    if (JSON.stringify(old.answer) !== JSON.stringify(row.answer) || JSON.stringify(old.payload) !== JSON.stringify(row.payload)) {
      const { data: answers } = await admin.from("test_answers").select("attempt_id, response").eq("item_id", itemId).returns<{ attempt_id: string; response: Response }[]>();
      regrade = (answers ?? []).map((a) => ({ attempt_id: a.attempt_id, correct: gradeResponse(row.type, row.payload, row.answer, a.response).correct }));
    }
  }
  const { data, error } = await admin.rpc("save_test_item", { p_user: userId, p_test: testId, p_item: itemId, p: row, p_regrade: regrade });
  if (error?.message.includes("regrade_retry")) return "retry";
  const r = data as { ok: boolean; reason?: string; id?: number; regraded?: boolean } | null;
  if (error || !r?.ok) {
    const msg: Record<string, string> = { type_locked: "Javob berilgan savolning turini o'zgartirib bo'lmaydi.", items_count: `Testda ${MAX_ITEMS} tagacha savol.` };
    return { ok: false, message: msg[r?.reason ?? ""] ?? "Saqlab bo'lmadi." };
  }
  return { ok: true, value: { id: r.id!, regraded: Boolean(r.regraded) } };
}

export async function publishTest(
  userId: string, testId: number, visibility: Visibility, groupId: number | null, rawSettings: unknown,
): Promise<AiResult<{ code: string; moderation: "ok" | "pending" | "rejected" | null; note: string | null }>> {
  const s = SettingsSchema.safeParse(rawSettings);
  if (!s.success) return { ok: false, message: s.error.issues[0]?.message ?? "Sozlamalar noto'g'ri." };
  const settings: TestSettings = s.data;
  const admin = createSupabaseAdmin();
  const { data } = await admin.rpc("publish_test", { p_user: userId, p_test: testId, p_visibility: visibility, p_group: groupId, p_settings: settings });
  const r = data as { ok: boolean; reason?: string; share_code?: string } | null;
  if (!r?.ok) {
    const msg: Record<string, string> = { no_items: "Testda savol yo'q.", group: "Guruhni tanlang (faqat o'z guruhingiz).", not_found: "Test topilmadi." };
    return { ok: false, message: msg[r?.reason ?? ""] ?? "Nashr qilib bo'lmadi." };
  }
  if (visibility !== "public") return { ok: true, value: { code: r.share_code!, moderation: null, note: null } };
  const m = await moderatePublicTest(userId, testId);
  return { ok: true, value: { code: r.share_code!, ...m } };
}

/**
 * Ochiq katalog: AI moderatsiya. Nashrda va ochiq test tahrirlanganda (SQL moderation='pending' qiladi) chaqiriladi.
 * AI ulanmagan yoki xato bo'lsa — navbatda qoladi.
 */
export async function moderatePublicTest(userId: string, testId: number): Promise<{ moderation: "ok" | "pending" | "rejected"; note: string | null }> {
  const admin = createSupabaseAdmin();
  const { data: cur } = await admin.from("tests").select("visibility, moderation, owner_id").eq("id", testId).maybeSingle<{ visibility: string; moderation: string | null; owner_id: string }>();
  if (!cur || cur.owner_id !== userId || cur.visibility !== "public" || cur.moderation !== "pending") {
    return { moderation: (cur?.moderation as "ok" | "rejected" | null) ?? "pending", note: null };
  }
  const c = aiClient();
  if (!c) return { moderation: "pending", note: null };
  const [{ data: t }, { data: items }] = await Promise.all([
    admin.from("tests").select("title, description").eq("id", testId).single<{ title: string; description: string | null }>(),
    admin.from("test_items").select("stem, context, payload").eq("test_id", testId).eq("status", "active").order("pos").returns<{ stem: string; context: string | null; payload: Payload }[]>(),
  ]);
  const mod = await moderateTest(c, {
    title: t?.title ?? "", description: t?.description ?? null,
    items: (items ?? []).map((i) => ({ stem: i.stem, context: i.context, options: "options" in i.payload ? i.payload.options : [] })),
  });
  if (!mod.ok) return { moderation: "pending", note: null };
  await logUsage(userId, "ugc_moderation", mod.usage);
  await admin.rpc("set_test_moderation", { p_test: testId, p_status: mod.data.verdict, p_note: mod.data.reason });
  return { moderation: mod.data.verdict, note: mod.data.reason };
}

// ─────────────────────────── Ishlash ───────────────────────────

export type RunnerTest = { id: number; code: string; title: string; reveal: Reveal; closesAt: string | null; ownerId: string };
export type RunnerAttempt = { id: string; itemIds: number[]; deadlineAt: string | null; finishedAt: string | null; score: number | null; correct: number | null; total: number | null };
export type RunnerItem = ClientQuestion & { explanation: string | null; answer: Answer; articleId: number | null; keyVersion: number };

type AttemptRow = {
  id: string; test_id: number; user_id: string | null; guest_token_hash: string | null; item_ids: number[];
  deadline_at: string | null; finished_at: string | null; score: number | null; correct_count: number | null; total_count: number | null;
  tests: { id: number; share_code: string; title: string; settings: { reveal?: Reveal; closes_at?: string }; owner_id: string };
};

/** Urinish (faqat o'z urinishi) — savollar javob kaliti bilan SERVERDA; klientga faqat ruxsat etilgani beriladi */
export async function loadAttempt(attemptId: string, actor: Actor) {
  const admin = createSupabaseAdmin();
  const { data: a } = await admin.from("test_attempts")
    .select("id, test_id, user_id, guest_token_hash, item_ids, deadline_at, finished_at, score, correct_count, total_count, tests!inner(id, share_code, title, settings, owner_id)")
    .eq("id", attemptId).maybeSingle<AttemptRow>();
  const mine = a && ((actor.userId && a.user_id === actor.userId) || (!actor.userId && !a.user_id && actor.guest && a.guest_token_hash === actor.guest));
  if (!a || !mine) return null;
  const ids = a.item_ids.map(Number);
  const [{ data: items }, { data: answers }] = await Promise.all([
    admin.from("test_items").select("id, type, stem, context, payload, difficulty, explanation, answer, article_id, status, key_version").in("id", ids)
      .returns<{ id: number; type: QuestionType; stem: string; context: string | null; payload: Payload; difficulty: number; explanation: string | null; answer: Answer; article_id: number | null; status: string; key_version: number }[]>(),
    admin.from("test_answers").select("item_id, response, is_correct").eq("attempt_id", attemptId).returns<{ item_id: number; response: Response; is_correct: boolean }[]>(),
  ]);
  const byId = new Map((items ?? []).map((i) => [Number(i.id), i]));
  const ordered: RunnerItem[] = ids.flatMap((id) => {
    const i = byId.get(id);
    return i && i.status === "active"
      ? [{ id, type: i.type, stem: i.stem, context: i.context, payload: i.payload, difficulty: i.difficulty, explanation: i.explanation, answer: i.answer, articleId: i.article_id, keyVersion: i.key_version }]
      : [];
  });
  return {
    test: { id: a.tests.id, code: a.tests.share_code, title: a.tests.title, reveal: a.tests.settings.reveal ?? "end", closesAt: a.tests.settings.closes_at ?? null, ownerId: a.tests.owner_id } satisfies RunnerTest,
    attempt: {
      id: a.id, itemIds: ids, deadlineAt: a.deadline_at, finishedAt: a.finished_at,
      score: a.score == null ? null : Number(a.score), correct: a.correct_count, total: a.total_count,
    } satisfies RunnerAttempt,
    items: ordered,
    answers: new Map((answers ?? []).map((x) => [Number(x.item_id), x])),
  };
}

export type TestAnswerResult =
  | { ok: true; revealed: false }
  | { ok: true; revealed: true; correct: boolean; answer: Answer; explanation: string | null }
  | { ok: false; message: string };

const ANSWER_ERR: Record<string, string> = {
  finished: "Test yakunlangan.", time_up: "Vaqt tugadi.", duplicate: "Bu savolga javob berilgan.",
  not_in_attempt: "Savol bu testga tegishli emas.", not_found: "Urinish topilmadi.",
};

export async function answerTestItem(attemptId: string, itemId: number, response: Response): Promise<TestAnswerResult> {
  const actor = await currentActor();
  // Muallif shu orada javob kalitini o'zgartirsa (stale_key) — yangi kalit bilan bir marta qayta baholanadi
  for (let attempt = 0; attempt < 2; attempt++) {
    const loaded = await loadAttempt(attemptId, actor);
    const item = loaded?.items.find((i) => i.id === itemId);
    if (!loaded || !item) return { ok: false, message: ANSWER_ERR.not_found };
    const g = gradeResponse(item.type, item.payload, item.answer, response);
    const { data } = await createSupabaseAdmin().rpc("save_test_answer", {
      p_attempt: attemptId, p_user: actor.userId, p_guest: actor.guest, p_item: itemId, p_response: response, p_correct: g.correct, p_key: item.keyVersion,
    });
    const r = data as { ok: boolean; reason?: string; reveal?: Reveal } | null;
    if (r?.reason === "stale_key") continue;
    return answerResult(r, g.correct, item);
  }
  return { ok: false, message: "Javobni saqlab bo'lmadi. Qayta urinib ko'ring." };
}

function answerResult(r: { ok: boolean; reason?: string; reveal?: Reveal } | null, correct: boolean, item: RunnerItem): TestAnswerResult {
  if (!r?.ok) return { ok: false, message: ANSWER_ERR[r?.reason ?? ""] ?? "Javobni saqlab bo'lmadi." };
  if (r.reveal !== "each") return { ok: true, revealed: false };
  return { ok: true, revealed: true, correct, answer: item.answer, explanation: item.explanation };
}

export async function finishTestAttempt(attemptId: string) {
  const actor = await currentActor();
  const { data } = await createSupabaseAdmin().rpc("finish_test_attempt", { p_attempt: attemptId, p_user: actor.userId, p_guest: actor.guest });
  return Boolean((data as { ok: boolean } | null)?.ok);
}
