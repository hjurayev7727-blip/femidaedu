// Foydalanuvchi testlari (V3, 4-qism): limitlar, sozlamalar, ulashish havolalari, savol tahriri va modda bog'lash.
// Sof funksiyalar — server (lib/user-tests-server.ts) va sahifalar shu yerdan foydalanadi.
import { z } from "zod";
import { draftToQuestion, type Draft, type DraftQuestion } from "@/lib/ai";
import type { Answer, Payload, QuestionType } from "@/lib/questions";

/** Bepul: haftasiga 10 ta AI test, har biri 10 tagacha savol */
export const FREE_WEEKLY_TESTS = 10;
export const FREE_MAX_ITEMS = 10;
/** Premium: xarajat nazorati uchun haftalik chegara */
export const PREMIUM_WEEKLY_TESTS = 100;
export const MIN_ITEMS = 5;
export const MAX_ITEMS = 50;
/** AI bir so'rovda shuncha savol tuzadi (katta test bo'laklarga bo'linadi) */
export const CHUNK = 10;

export type Visibility = "private" | "link" | "group" | "public";
export type Reveal = "each" | "end" | "after_close";

export const VISIBILITY_LABEL: Record<Visibility, { title: string; hint: string }> = {
  private: { title: "Faqat men", hint: "Hech kim ko'rmaydi — o'zingiz mashq qilasiz" },
  link: { title: "Havola bilan", hint: "Havola yoki kodni bilgan har kim ishlaydi" },
  group: { title: "Guruhga", hint: "Faqat tanlangan guruh a'zolari" },
  public: { title: "Ochiq katalog", hint: "Tekshiruvdan keyin katalogda hammaga ko'rinadi" },
};

export const REVEAL_LABEL: Record<Reveal, string> = {
  each: "Har savoldan keyin",
  end: "Test oxirida",
  after_close: "Muddat tugagach",
};

export const SHARE_CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const normalizeCode = (s: string) => s.trim().toUpperCase().replace(/[\s-]/g, "");

export function shareLinks(code: string, siteUrl: string, bot: string | null) {
  return {
    web: `${siteUrl.replace(/\/$/, "")}/t/${code}`,
    telegram: bot ? `https://t.me/${bot}?startapp=t_${code}` : null,
    share: (url: string, title: string) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  };
}

const isoDate = z.iso.datetime({ offset: true }).or(z.iso.datetime());

export const SettingsSchema = z
  .object({
    timer_min: z.number().int().min(1).max(240).optional(),
    opens_at: isoDate.optional(),
    closes_at: isoDate.optional(),
    max_attempts: z.number().int().min(1).max(20).optional(),
    shuffle: z.boolean().optional(),
    reveal: z.enum(["each", "end", "after_close"]).default("end"),
    guests: z.boolean().default(true),
  })
  .refine((s) => !s.opens_at || !s.closes_at || new Date(s.opens_at) < new Date(s.closes_at), { message: "Boshlanish vaqti tugashdan oldin bo'lsin" })
  .refine((s) => s.reveal !== "after_close" || Boolean(s.closes_at), { message: "\"Muddat tugagach\" uchun tugash vaqtini belgilang" });
export type TestSettings = z.infer<typeof SettingsSchema>;

/** To'g'ri javoblar qachon ko'rsatiladi */
export function canReveal(reveal: Reveal, o: { finished: boolean; closesAt: string | null; now?: Date }): boolean {
  if (reveal === "each") return true;
  if (!o.finished) return false;
  if (reveal === "end") return true;
  return !o.closesAt || (o.now ?? new Date()) >= new Date(o.closesAt);
}

/** "12-modda 2-qism" → "12"; "245-1-modda" → "245-1"; "12" → "12" */
export function parseArticleRef(ref: string): string | null {
  const m = /(\d+(?:\s*[-–—]\s*\d+)*)\s*[-–—]?\s*modda/i.exec(ref) ?? /^\s*(\d+(?:-\d+)*)\s*$/.exec(ref);
  return m ? m[1].replace(/\s*[-–—]\s*/g, "-") : null;
}

/** Savol manbasi (article_ref) → bazadagi modda. Topilmasa — null (test "o'z materiali" bo'ladi) */
export function matchArticle(ref: string, articles: { id: number; number: string }[]): number | null {
  const n = parseArticleRef(ref);
  if (!n) return null;
  return articles.find((a) => a.number === n)?.id ?? null;
}

/** 25 → [10, 10, 5] */
export function chunkCounts(total: number, size = CHUNK): number[] {
  const out: number[] = [];
  for (let left = total; left > 0; left -= size) out.push(Math.min(size, left));
  return out;
}

export type ItemRow = {
  type: QuestionType;
  stem: string;
  context: string | null;
  payload: Payload;
  answer: Answer;
  explanation: string | null;
  article_id: number | null;
  difficulty: 1 | 2 | 3;
  fingerprint?: string;
};

/** AI qoralamasi → test savoli (tekshiruv, variantlarni aralashtirish, modda bog'lash) */
export function draftToItem(d: Draft, sourceTitle: string, articles: { id: number; number: string }[]):
  { ok: true; item: ItemRow; q: DraftQuestion } | { ok: false; reason: string } {
  const conv = draftToQuestion(d, sourceTitle);
  if (!conv.ok) return conv;
  const q = conv.q;
  return {
    ok: true,
    q,
    item: {
      type: q.type, stem: q.stem, context: q.context, payload: q.payload, answer: q.answer,
      explanation: q.explanation || null, article_id: matchArticle(d.article_ref, articles), difficulty: q.difficulty, fingerprint: q.fingerprint,
    },
  };
}

// ─────────────────────────── Tahrirlagich ───────────────────────────

const text = (max: number) => z.string().trim().max(max);
const Base = z.object({
  stem: text(1000).min(5, "Savol matni juda qisqa"),
  explanation: text(1500).optional().default(""),
  article_id: z.number().int().positive().nullable().optional().default(null),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
});

export const ItemInputSchema = z.discriminatedUnion("type", [
  Base.extend({
    type: z.enum(["single", "fill_blank", "case"]),
    context: text(1500).optional().default(""),
    options: z.array(text(300).min(1, "Bo'sh variant")).min(2).max(6),
    correct: z.number().int().min(0),
  }),
  Base.extend({
    type: z.literal("multi"),
    context: text(1500).optional().default(""),
    options: z.array(text(300).min(1, "Bo'sh variant")).min(3).max(8),
    correct_many: z.array(z.number().int().min(0)).min(1),
  }),
  Base.extend({
    type: z.literal("open"),
    kind: z.enum(["number", "article", "text"]),
    accepted: z.array(text(120).min(1)).min(1).max(10),
    show: text(200).optional().default(""),
  }),
]);
export type ItemInput = z.infer<typeof ItemInputSchema>;

/** Tahrirlagich formasi → DB qatori. Xato bo'lsa — foydalanuvchiga ko'rsatiladigan matn */
export function inputToRow(raw: unknown): { ok: true; row: ItemRow } | { ok: false; message: string } {
  const p = ItemInputSchema.safeParse(raw);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Savol noto'g'ri to'ldirilgan" };
  const i = p.data;
  const common = { stem: i.stem, explanation: i.explanation || null, article_id: i.article_id, difficulty: i.difficulty };
  if (i.type === "open") {
    const accepted = [...new Set(i.accepted)];
    if (i.kind !== "text" && accepted.some((a) => !Number.isFinite(parseFloat(a)))) return { ok: false, message: "Bu turda javob son bo'lishi kerak" };
    return { ok: true, row: { ...common, type: "open", context: null, payload: { kind: i.kind }, answer: { accepted, show: i.show || accepted[0] } } };
  }
  const norm = i.options.map((o) => o.toLowerCase());
  if (new Set(norm).size !== norm.length) return { ok: false, message: "Variantlar takrorlanmasin" };
  if (i.type === "fill_blank" && !i.stem.includes("___")) return { ok: false, message: "Bo'sh joyni ___ bilan belgilang" };
  if (i.type === "case" && !i.context) return { ok: false, message: "Vaziyat matnini yozing" };
  const context = i.type === "case" ? i.context : null;
  if (i.type === "multi") {
    const idx = [...new Set(i.correct_many)].sort((a, b) => a - b);
    if (idx.some((x) => x >= i.options.length)) return { ok: false, message: "To'g'ri javobni belgilang" };
    return { ok: true, row: { ...common, type: "multi", context: i.context || null, payload: { options: i.options }, answer: { indexes: idx } } };
  }
  if (i.correct >= i.options.length) return { ok: false, message: "To'g'ri javobni belgilang" };
  return { ok: true, row: { ...common, type: i.type, context, payload: { options: i.options }, answer: { index: i.correct } } };
}

/** DB qatori → tahrirlagich formasi */
export function rowToInput(r: Pick<ItemRow, "type" | "stem" | "context" | "payload" | "answer" | "explanation" | "article_id" | "difficulty">): ItemInput {
  const common = { stem: r.stem, explanation: r.explanation ?? "", article_id: r.article_id, difficulty: r.difficulty };
  if (r.type === "open") {
    const a = r.answer as { accepted: string[]; show: string };
    return { ...common, type: "open", kind: (r.payload as { kind: "number" | "article" | "text" }).kind, accepted: a.accepted, show: a.show };
  }
  const options = (r.payload as { options: string[] }).options ?? [];
  if (r.type === "multi") return { ...common, type: "multi", context: r.context ?? "", options, correct_many: (r.answer as { indexes: number[] }).indexes };
  const t = r.type === "fill_blank" || r.type === "case" ? r.type : "single";
  return { ...common, type: t, context: r.context ?? "", options, correct: (r.answer as { index: number }).index };
}

export const START_ERRORS: Record<string, string> = {
  not_found: "Test topilmadi yoki yopilgan.",
  login_required: "Bu testni ishlash uchun tizimga kiring.",
  group_only: "Bu test faqat guruh a'zolari uchun.",
  not_open: "Test hali ochilmagan.",
  closed: "Test muddati tugagan.",
  max_attempts: "Urinishlar soni tugagan.",
  no_items: "Testda savol yo'q.",
};

export const ratingText = (rating: number | null, n: number) => (rating == null ? "Baho yo'q" : `★ ${rating.toFixed(1)} (${n})`);

/** "1-10, 15, 245-1" → ["1".."10", "15", "245-1"]: "a-b" (b > a) — oraliq, aks holda modda raqami (245-1) */
export function parseArticleRange(input: string, max = 40): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,;\s]+/).map((s) => s.trim().replace(/[–—]/g, "-")).filter(Boolean)) {
    const m = /^(\d+)-(\d+)$/.exec(part);
    if (m && Number(m[2]) > Number(m[1])) {
      for (let n = Number(m[1]); n <= Number(m[2]) && out.length < max; n++) out.push(String(n));
    } else if (/^\d+(?:-\d+)*$/.test(part)) out.push(part);
    if (out.length >= max) break;
  }
  return [...new Set(out)].slice(0, max);
}

/** Joriy hafta boshi (dushanba, Toshkent vaqti) — SQL uz_week() bilan bir xil */
export function uzWeekStart(now = new Date()): string {
  const d = new Date(now.getTime() + 5 * 3600_000);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
