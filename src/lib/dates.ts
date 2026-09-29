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
