// Hamjamiyat: kunlik javob limiti (foydalanuvchi 5, guruh 40 — testda kichik) va kunlik post takrorlanmasligi.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-0000000c0001";
const consume = async (user: number, userLimit = 2, chatLimit = 3, chat = -100) =>
  (await db.query<{ ok: boolean }>(`select public.consume_community_quota($1, $2, $3, $4) as ok`, [chat, user, userLimit, chatLimit])).rows[0].ok;

beforeAll(async () => {
  db = await createTestDb({ seed: false });
  await db.query(`insert into auth.users (id, email) values ($1, 'c@x.uz')`, [U]);
});

describe("consume_community_quota", () => {
  it("foydalanuvchi limiti, keyin guruh limiti; limit tugasa hisob o'zgarmaydi", async () => {
    expect(await consume(1)).toBe(true);
    expect(await consume(1)).toBe(true);
    expect(await consume(1)).toBe(false); // 1-foydalanuvchi: 2/2
    expect(await consume(2)).toBe(true);  // guruh: 3/3
    expect(await consume(3)).toBe(false);
    expect(await consume(3, 2, 3, -200)).toBe(true); // boshqa guruh — alohida
    const { rows } = await db.query<{ telegram_id: string; answers: number }>(
      `select telegram_id, answers from public.community_usage where chat_id = -100 order by telegram_id`);
    expect(rows.map((r) => [Number(r.telegram_id), r.answers])).toEqual([[0, 3], [1, 2], [2, 1], [3, 0]]);
  });

  it("noto'g'ri foydalanuvchi — false", async () => {
    expect(await consume(0)).toBe(false);
  });

  it("community_posts: (guruh, sana) bo'yicha bitta qator", async () => {
    await db.query(`insert into public.community_posts (chat_id, day) values (-100, '2026-10-08') on conflict do nothing`);
    const r = await db.query(`insert into public.community_posts (chat_id, day) values (-100, '2026-10-08') on conflict do nothing returning day`);
    expect(r.rows).toHaveLength(0);
  });

  it("klient jadval va funksiyaga kira olmaydi", async () => {
    await expect(asUser(db, U, () => db.query(`select * from public.community_usage`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, U, () => db.query(`select public.consume_community_quota(-100, 9, 5, 40)`))).rejects.toThrow(/permission denied/);
  });
});
