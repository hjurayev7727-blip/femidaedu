/** Toshkent vaqti bo'yicha sanagacha qolgan to'liq kunlar (server komponentida har so'rovda hisoblanadi). */
export function daysUntil(target: Date, now: Date = new Date()): number {
  const day = (d: Date) => Date.parse(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }));
  return Math.max(0, Math.round((day(target) - day(now)) / 86_400_000));
}

/** Server vaqti (ms) — taymerni foydalanuvchi soatiga bog'liq qilmaslik uchun sahifaga beriladi */
export function serverNow(): number {
  return Date.now();
}

/** Joriy oyning boshi (Toshkent vaqti) — oylik limitlar uchun */
export function tashkentMonthStart(now: Date = new Date()): number {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }); // YYYY-MM-DD
  return Date.parse(`${ymd.slice(0, 8)}01T00:00:00+05:00`);
}

/** "12-oktabr, 20:00" — Toshkent vaqti */
export function fmtWhen(s: string): string {
  return new Date(s).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
}

/** Ko'rsatish uchun streak: oxirgi faol kun kecha yoki bugundan oldin bo'lsa — uzilgan (0) */
export function effectiveStreak(streakDays: number, lastActiveOn: string | null, now: Date = new Date()): number {
  if (!lastActiveOn || streakDays <= 0) return 0;
  const today = Date.parse(now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }));
  return (today - Date.parse(lastActiveOn)) / 86_400_000 <= 1 ? streakDays : 0;
}

const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/**
 * "15-oktabr, 23:00" — Toshkent vaqti (UTC+5, yozgi vaqt yo'q). Intl lokal ma'lumotiga bog'liq emas:
 * server va brauzerda bir xil natija (klient komponentlarida gidratatsiya mos kelishi uchun).
 */
export function fmtUz(iso: string, opts: { time?: boolean; short?: boolean } = {}): string {
  const d = new Date(new Date(iso).getTime() + 5 * 3600_000);
  const month = (opts.short ? UZ_MONTHS_SHORT : UZ_MONTHS)[d.getUTCMonth()];
  const date = `${d.getUTCDate()}-${month}`;
  if (opts.time === false) return date;
  return `${date}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
