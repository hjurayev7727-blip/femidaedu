// AI ustoz: moddalarni qidirish (RAG), zaif moddalar, haftalik limit, RLS.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-0000000b0001";
const V = "00000000-0000-0000-0000-0000000b0002";
let art: Record<string, number> = {};

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'u@x.uz'), ($2, 'v@x.uz')`, [U, V]);
  const payload = {
    code: "MK", title: "Mehnat kodeksi", field: "mehnat",
    articles: [
      { number: "1", title: "Mehnat shartnomasi tushunchasi", body: "Mehnat shartnomasi xodim va ish beruvchi o'rtasidagi kelishuvdir.", sort: 1 },
      { number: "2", title: "Sinov muddati", body: "Sinov muddati uch oydan oshmasligi kerak.", sort: 2 },
      { number: "3", title: "Ta'til", body: "Har yili mehnat ta'tili beriladi.", sort: 3 },
    ],
  };
  await db.query(`select public.import_law_document($1::jsonb)`, [JSON.stringify(payload)]);
  art = Object.fromEntries((await db.query<{ number: string; id: number }>(`select number, id from articles`)).rows.map((r) => [r.number, Number(r.id)]));
});

describe("search_articles", () => {
  it("qo'shimchali so'z prefiks bilan topiladi, sarlavhadagi moslik yuqorida", async () => {
    const { rows } = await db.query<{ number: string }>(`select number from public.search_articles('Mehnat shartnomasini qanday bekor qilish mumkin?', null, 5)`);
    expect(rows[0].number).toBe("1");
    const s = await db.query<{ number: string }>(`select number from public.search_articles('sinovdagi muddat', 'mehnat', 5)`);
    expect(s.rows.map((r) => r.number)).toContain("2");
  });

  it("qisqa so'zlar va bo'sh so'rov — natija yo'q; boshqa soha filtri", async () => {
    expect((await db.query(`select * from public.search_articles('va bu', null, 5)`)).rows).toHaveLength(0);
    expect((await db.query(`select * from public.search_articles('mehnat', 'oila', 5)`)).rows).toHaveLength(0);
  });

  it("klient to'g'ridan-to'g'ri chaqira olmaydi", async () => {
    await expect(asUser(db, U, () => db.query(`select * from public.search_articles('mehnat', null, 5)`))).rejects.toThrow(/permission denied/);
  });
});

describe("weak_articles va limit", () => {
  it("xato bor va o'zlashtirilmagan moddalar, ko'p xatolisi birinchi", async () => {
    await db.query(`insert into article_progress (user_id, article_id, seen, correct) values ($1, $2, 3, 0), ($1, $3, 2, 1), ($1, $4, 3, 3)`, [U, art["1"], art["2"], art["3"]]);
    const { rows } = await db.query<{ number: string }>(`select number from public.weak_articles($1, 10)`, [U]);
    expect(rows.map((r) => r.number)).toEqual(["1", "2"]);
  });

  it("haftalik ustoz limiti test limitidan alohida", async () => {
    const q = () => db.query<{ r: number | null }>(`select public.consume_tutor_quota($1, 2) as r`, [V]).then((x) => x.rows[0].r);
    expect(await q()).toBe(1);
    expect(await q()).toBe(2);
    expect(await q()).toBeNull();
    await db.query(`select public.refund_tutor_quota($1)`, [V]);
    expect(await q()).toBe(2);
    const w = (await db.query<{ tests: number }>(`select tests from ai_weekly where user_id = $1`, [V])).rows[0];
    expect(w.tests).toBe(0);
  });

  it("suhbatlar faqat egasiga ko'rinadi", async () => {
    const t = (await db.query<{ id: string }>(`insert into tutor_threads (user_id, mode, title) values ($1, 'explain', 'T') returning id`, [U])).rows[0].id;
    await db.query(`insert into tutor_messages (thread_id, role, content) values ($1, 'user', 'salom')`, [t]);
    expect(await asUser(db, U, async () => (await db.query(`select * from tutor_messages`)).rows.length)).toBe(1);
    expect(await asUser(db, V, async () => (await db.query(`select * from tutor_messages`)).rows.length)).toBe(0);
    await expect(asUser(db, U, () => db.query(`insert into tutor_messages (thread_id, role, content) values ($1, 'assistant', 'x')`, [t]))).rejects.toThrow(/permission denied/);
  });
});
