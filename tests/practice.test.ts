// Mashq rejimining SQL funksiyalari: tanlash, limit, takrorlash navbati, streak, yakunlash.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

const U = "00000000-0000-0000-0000-0000000000a1";
const V = "00000000-0000-0000-0000-0000000000a2";
let db: PGlite;

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const topicId = async (slug: string) => (await one<{ id: number }>(`select id from public.topics where slug = $1`, [slug])).id;
const start = async (uid: string, slug: string, n = 10) =>
  (await one<{ id: string }>(`select public.start_practice($1, $2, $3) as id`, [uid, await topicId(slug), n])).id;
const record = async (uid: string, attempt: string, q: number, correct: boolean, limit: number | null = null) =>
  (
    await one<{ r: { ok: boolean; reason?: string; used_today?: number } }>(
      `select public.record_answer($1, $2, $3, '{"index":0}', $4, $5, 1000, $6) as r`,
      [uid, attempt, q, correct, correct ? 1 : 0, limit],
    )
  ).r;
const questionIds = async (attempt: string) =>
  (await one<{ q: number[] }>(`select question_ids as q from public.attempts where id = $1`, [attempt])).q.map(Number);

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
  await db.exec(`insert into auth.users (id, email) values ('${U}', 'u@x.uz'), ('${V}', 'v@x.uz')`);
}, 60_000);

describe("savol tanlash", () => {
  it("modul tanlansa — faqat shu modul hujjatlaridan, takrorsiz", async () => {
    const a = await start(U, "modul-1", 20);
    const ids = await questionIds(a);
    expect(ids).toHaveLength(20);
    expect(new Set(ids).size).toBe(20);
    const { n } = await one<{ n: number }>(
      `select count(*)::int as n from public.questions q
       where q.id = any($1::bigint[])
         and q.topic_id not in (select public.topic_subtree((select id from public.topics where slug = 'modul-1')))`,
      [ids],
    );
    expect(n).toBe(0);
  });

  it("savoli yo'q mavzu — xato", async () => {
    await db.exec(`insert into public.topics (slug, title) values ('bosh-mavzu', 'Bo''sh')`);
    await expect(start(U, "bosh-mavzu")).rejects.toThrow(/no_questions/);
  });

  it("avval ko'rilmagan savollar beriladi", async () => {
    const first = await start(V, "hujjat-2", 10); // Davlat bayrog'i: 25 savol
    for (const q of await questionIds(first)) await record(V, first, q, true);
    const second = await questionIds(await start(V, "hujjat-2", 10));
    const seen = new Set(await questionIds(first));
    expect(second.filter((q) => seen.has(q))).toHaveLength(0);
  });
});

describe("javob yozish", () => {
  it("takror javob, begona savol va yakunlangan urinish rad etiladi", async () => {
    const a = await start(U, "hujjat-3", 5);
    const [q1] = await questionIds(a);
    expect((await record(U, a, q1, true)).ok).toBe(true);
    expect(await record(U, a, q1, true)).toMatchObject({ ok: false, reason: "duplicate" });
    expect(await record(U, a, 999999, true)).toMatchObject({ ok: false, reason: "not_in_attempt" });
    expect(await record(V, a, q1, true)).toMatchObject({ ok: false, reason: "not_found" }); // boshqa foydalanuvchi urinishi
    await db.query(`select public.finish_attempt($1, $2)`, [U, a]);
    const [, q2] = await questionIds(a);
    expect(await record(U, a, q2, true)).toMatchObject({ ok: false, reason: "finished" });
  });

  it("kunlik limit: bepul foydalanuvchi limitdan oshmaydi", async () => {
    const W = "00000000-0000-0000-0000-0000000000a3";
    await db.exec(`insert into auth.users (id, email) values ('${W}', 'w@x.uz')`);
    const a = await start(W, "hujjat-4", 5);
    const ids = await questionIds(a);
    expect((await record(W, a, ids[0], true, 2)).ok).toBe(true);
    expect((await record(W, a, ids[1], true, 2)).ok).toBe(true);
    expect(await record(W, a, ids[2], true, 2)).toMatchObject({ ok: false, reason: "limit" });
    // limit oshganda javob yozilmagan
    const { n } = await one<{ n: number }>(`select count(*)::int as n from public.attempt_answers where attempt_id = $1`, [a]);
    expect(n).toBe(2);
    // Premium (limit = null) — cheksiz
    expect((await record(W, a, ids[2], true, null)).ok).toBe(true);
  });

  it("xato javob takrorlash navbatiga tushadi, to'g'risi keyingi qutiga o'tkazadi", async () => {
    const X = "00000000-0000-0000-0000-0000000000a4";
    await db.exec(`insert into auth.users (id, email) values ('${X}', 'x@x.uz')`);
    const a = await start(X, "hujjat-5", 5);
    const [q] = await questionIds(a);
    await record(X, a, q, false);
    const r1 = await one<{ box: number; due: number }>(
      `select box, (due_on - public.uz_today()) as due from public.review_queue where user_id = $1 and question_id = $2`,
      [X, q],
    );
    expect(r1).toEqual({ box: 1, due: 1 });

    const b = await one<{ id: string }>(
      `insert into public.attempts (user_id, mode, question_ids) values ($1, 'review', array[$2::bigint]) returning id`,
      [X, q],
    );
    await record(X, b.id, q, true);
    const r2 = await one<{ box: number; due: number }>(
      `select box, (due_on - public.uz_today()) as due from public.review_queue where user_id = $1 and question_id = $2`,
      [X, q],
    );
    expect(r2).toEqual({ box: 2, due: 3 });
  });

  it("streak: kuniga 10-javobda hisoblanadi, ketma-ket kunlar qo'shiladi", async () => {
    const Y = "00000000-0000-0000-0000-0000000000a5";
    await db.exec(`insert into auth.users (id, email) values ('${Y}', 'y@x.uz')`);
    await db.query(`update public.profiles set streak_days = 4, streak_best = 4, last_active_on = public.uz_today() - 1 where id = $1`, [Y]);
    const a = await start(Y, "modul-2", 12);
    const ids = await questionIds(a);
    for (const q of ids.slice(0, 9)) await record(Y, a, q, true);
    expect((await one<{ s: number }>(`select streak_days as s from public.profiles where id = $1`, [Y])).s).toBe(4);
    await record(Y, a, ids[9], true);
    const p = await one<{ s: number; b: number }>(`select streak_days as s, streak_best as b from public.profiles where id = $1`, [Y]);
    expect(p).toEqual({ s: 5, b: 5 });
    await record(Y, a, ids[10], true); // 11-javob streakni qayta oshirmaydi
    expect((await one<{ s: number }>(`select streak_days as s from public.profiles where id = $1`, [Y])).s).toBe(5);
  });
});

describe("yakunlash va ruxsatlar", () => {
  it("natija: foiz va to'g'ri javoblar soni", async () => {
    const Z = "00000000-0000-0000-0000-0000000000a6";
    await db.exec(`insert into auth.users (id, email) values ('${Z}', 'z@x.uz')`);
    const a = await start(Z, "hujjat-6", 4);
    const ids = await questionIds(a);
    await record(Z, a, ids[0], true);
    await record(Z, a, ids[1], true);
    await record(Z, a, ids[2], false);
    const r = await one<{ correct_count: number; raw_score: string }>(
      `select correct_count, raw_score from public.finish_attempt($1, $2)`,
      [Z, a],
    );
    expect(r).toEqual({ correct_count: 2, raw_score: "50.00" }); // javobsiz 4-savol ham hisobga kiradi
  });

  it("mijoz server funksiyalarini chaqira olmaydi", async () => {
    for (const sql of [
      `select public.start_practice('${U}', 1, 10)`,
      `select public.record_answer('${U}', gen_random_uuid(), 1, '{}', true, 1, 1, null)`,
      `select public.finish_attempt('${U}', gen_random_uuid())`,
    ]) {
      await expect(asUser(db, U, () => db.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  it("o'quvchi o'z mavzu progressini ko'radi", async () => {
    const rows = await asUser(db, V, () =>
      db.query<{ answered: number }>(`select topic_id, answered::int from public.my_topic_progress()`).then((r) => r.rows),
    );
    expect(rows.reduce((s, r) => s + r.answered, 0)).toBe(10);
  });
});
