// AI ustoz (V3, 5-qism): limitlar, rejimlar, manba moddalarini tanlash, o'quv reja maqsadi. Sof funksiyalar.
import { z } from "zod";
import type { TutorMode } from "@/lib/ai";

/** Bepul: haftasiga 10 ta savol (ustoz + reja). Premium — xarajat nazorati uchun chegara */
export const TUTOR_FREE_WEEKLY = 10;
export const TUTOR_PREMIUM_WEEKLY = 200;
export const MAX_SOURCES = 6;

export const MODE_INFO: Record<TutorMode, { title: string; icon: string; hint: string; placeholder: string }> = {
  explain: {
    title: "Tushuntirish", icon: "💡", hint: "Modda yoki tushunchani oddiy tilda, misol bilan",
    placeholder: "Masalan: Mehnat shartnomasini bekor qilish asoslari qanday?",
  },
  case: {
    title: "Kazus tahlili", icon: "⚖️", hint: "Vaziyatni yozing — qaysi moddalar tegishli, o'quv masalasi sifatida",
    placeholder: "Masalan: Aziz ishga qabul qilindi, lekin 2 oydan keyin sababsiz bo'shatildi. Bu qonuniymi?",
  },
};

/** Matndagi modda havolalari: "12-modda", "245-1-modda", "12 va 15-moddalar" → ["12", "245-1", "15"] */
export function extractArticleRefs(text: string, max = 5): string[] {
  const out: string[] = [];
  const re = /(\d+(?:-\d+)?)(?:\s*(?:,|va)\s*(\d+(?:-\d+)?))*\s*-\s*modda/gi;
  for (const m of text.matchAll(re)) {
    for (const n of m[0].match(/\d+(?:-\d+)?/g) ?? []) if (!out.includes(n)) out.push(n);
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export type SourceArticle = { id: number; number: string; title: string | null; body: string; doc_title: string; field_slug: string | null };

/** Manbalar: aniq ko'rsatilgan (modda sahifasi, raqam bilan) birinchi, keyin qidiruv natijasi; takrorsiz */
export function mergeSources(explicit: SourceArticle[], searched: SourceArticle[], max = MAX_SOURCES): SourceArticle[] {
  const seen = new Set<number>();
  const out: SourceArticle[] = [];
  for (const a of [...explicit, ...searched]) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

export const sourceRef = (a: Pick<SourceArticle, "doc_title" | "number">) => `${a.doc_title} ${a.number}-modda`;

export function threadTitle(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 70 ? `${t.slice(0, 67).trimEnd()}…` : t;
}

export const QuestionSchema = z.string().trim().min(3, "Savolni yozing").max(3000, "Savol 3000 belgidan oshmasin");

export const PlanGoalSchema = z
  .object({
    target: z.enum(["sertifikat", "soha"]),
    field: z.string().regex(/^[a-z-]{2,40}$/).nullable(),
    exam_date: z.iso.date().nullable(),
    minutes_per_day: z.number().int().min(15).max(240),
    level: z.enum(["boshlang'ich", "o'rta", "yuqori"]),
  })
  .refine((g) => g.target !== "soha" || g.field, { message: "Sohani tanlang" });
export type PlanGoal = z.infer<typeof PlanGoalSchema>;

/** Rejadagi joriy hafta (reja tuzilgan kundan boshlab, 1-hafta) */
export function currentPlanWeek(createdAt: string, now = new Date()): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(createdAt).getTime()) / (7 * 86_400_000)) + 1);
}
