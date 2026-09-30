// Huquq sohalari katalogi uchun sof yordamchilar (SQL'dagi article_mastered bilan bir xil qoida).

export type Mastery = "yangi" | "zaif" | "organilmoqda" | "ozlashtirildi";

/** Modda holati: kamida 2 ta to'g'ri va to'g'ri ulushi ≥ 2/3 — o'zlashtirilgan */
export function mastery(seen: number, correct: number): Mastery {
  if (seen <= 0) return "yangi";
  if (correct >= 2 && correct * 3 >= seen * 2) return "ozlashtirildi";
  return correct * 2 >= seen ? "organilmoqda" : "zaif";
}

export const MASTERY_LABEL: Record<Mastery, string> = {
  yangi: "O'rganilmagan",
  zaif: "Zaif",
  organilmoqda: "O'rganilmoqda",
  ozlashtirildi: "O'zlashtirilgan",
};

/** Moddalar xaritasidagi rang (Tailwind sinfi) */
export const MASTERY_DOT: Record<Mastery, string> = {
  yangi: "bg-mute/40",
  zaif: "bg-no",
  organilmoqda: "bg-amber",
  ozlashtirildi: "bg-ok",
};

export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export const PRIORITY_LABEL: Record<string, string> = {
  A: "To'liq: har modda, konspekt, kazus",
  B: "Asosiy boblar",
  C: "Umumiy tanishuv · bepul",
};

/** Modda sarlavhasi: "28-modda. Sarlavha" */
export function articleHeading(a: { number: string; title: string | null }): string {
  return a.title ? `${a.number}-modda. ${a.title}` : `${a.number}-modda`;
}

/** Modda matnini xatboshilarga ajratish (bo'sh qatorlarsiz) */
export function paragraphs(body: string): string[] {
  return body.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}
