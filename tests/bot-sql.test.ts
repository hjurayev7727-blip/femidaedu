import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
let n = 0;
async function user(opts: { tg?: number; bot?: boolean; morning?: boolean; evening?: boolean; today?: number; activeDaysAgo?: number | null }) {
  const id = `00000000-0000-0000-0000-0000000002${String(++n).padStart(2, "0")}`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [
    id, `b${n}@x.uz`, JSON.stringify({ full_name: `U${n}`, ...(opts.tg ? { telegram_id: String(opts.tg) } : {}) }),
  ]);
  await db.query(
    `update public.profiles set bot_enabled = $2, notify_morning = $3, notify_evening = $4,
       last_active_on = case when $5::int is null then null else public.uz_today() - $5::int end where id = $1`,
    [id, opts.bot ?? true, opts.morning ?? true, opts.evening ?? true, opts.activeDaysAgo ?? 0],
  );
  if (opts.today) await db.query(`insert into public.daily_usage (user_id, questions) values ($1, $2)`, [id, opts.today]);
  return id;
}
const recipients = async (slot: string) =>
  (await db.query<{ telegram_id: string }>(`select telegram_id from public.bot_recipients($1)`, [slot])).rows.map((r) => Number(r.telegram_id));

beforeAll(async () => {
  db = await createTestDb();
  await user({ tg: 1001 });                              // hammasi yoqilgan, bugun 0 savol
  await user({ tg: 1002, today: 12 });                   // bugun 10+ — kechki eslatma kerak emas
  await user({ tg: 1003, bot: false });                  // botni bloklagan
  await user({ tg: 1004, morning: false });              // ertalabkini o'chirgan
  await user({ tg: 1005, evening: false, today: 3 });    // kechkini o'chirgan
  await user({ tg: 1006, activeDaysAgo: 30 });           // uzoq vaqt kirmagan
  await user({});                                        // Telegram bog'lanmagan
});

describe("bot_recipients", () => {
  it("ertalab: bot yoqilgan va ertalabki eslatmani o'chirmaganlar", async () => {
    expect(await recipients("morning")).toEqual([1001, 1002, 1005, 1006]);
  });
  it("kechqurun: bugun 10 tadan kam savol, yaqinda faol, eslatma yoqilgan", async () => {
    expect(await recipients("evening")).toEqual([1001, 1004]);
  });
  it("noma'lum slot — hech kim", async () => {
    expect(await recipients("tunda")).toEqual([]);
  });
});

describe("bot_user_stats va ruxsatlar", () => {
  it("topilgan va topilmagan foydalanuvchi", async () => {
    const s = (await db.query<{ s: Record<string, unknown> }>(`select public.bot_user_stats(1002) as s`)).rows[0].s;
    expect(s).toMatchObject({ found: true, name: "U2", today: 12, due: 0, last_mock: null });
    const none = (await db.query<{ s: Record<string, unknown> }>(`select public.bot_user_stats(999) as s`)).rows[0].s;
    expect(none).toEqual({ found: false });
  });

  it("foydalanuvchi eslatmalarni o'zgartira oladi, bot_enabled ni emas; server funksiyalari yopiq", async () => {
    const u = await user({ tg: 2001 });
    await asUser(db, u, () => db.query(`update public.profiles set notify_evening = false where id = $1`, [u]));
    await expect(asUser(db, u, () => db.query(`update public.profiles set bot_enabled = true where id = $1`, [u]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, u, () => db.query(`select * from public.bot_recipients('morning')`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, u, () => db.query(`select public.bot_user_stats(2001)`))).rejects.toThrow(/permission denied/);
  });
});
