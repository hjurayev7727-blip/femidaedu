// Ishga tushirishdan oldingi tekshiruvda topilgan zaifliklar uchun regressiya testlari.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMockPlan, type Blueprint, type PoolQuestion } from "@/lib/mock";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-00000000fe01";
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
  await db.query(`insert into auth.users (id, email) values ($1, 'f@x.uz')`, [U]);
}, 60_000);

describe("javob faqat mashq rejimlarida oshkor bo'ladi", () => {
  it("record_answer va finish_attempt sinov / musobaqa urinishlarini rad etadi", async () => {
    const t = await one<{ id: number; blueprint: Blueprint }>(`select id, blueprint from public.exam_templates limit 1`);
    const pool = (await db.query<{ id: string; type: PoolQuestion["type"]; difficulty: number; document_id: number | null }>(
      `select id, type, difficulty, document_id from public.questions`)).rows.map((r) => ({ id: Number(r.id), type: r.type, difficulty: r.difficulty, documentId: r.document_id }));
    const mock = await one<{ r: { id: string } }>(`select public.create_mock($1, $2, $3::jsonb, null) as r`, [U, t.id, JSON.stringify(buildMockPlan(pool, t.blueprint))]);
    const q = (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [mock.r.id])).q[0];
    const rec = await one<{ r: { ok: boolean; reason: string } }>(`select public.record_answer($1, $2, $3, '{}', true, 1, 1, null) as r`, [U, mock.r.id, q]);
    expect(rec.r).toEqual({ ok: false, reason: "not_found" });
    await expect(db.query(`select public.finish_attempt($1, $2)`, [U, mock.r.id])).rejects.toThrow(/not_found/);

    const c = await one<{ id: number }>(`insert into public.contests (title, question_ids, starts_at, ends_at) values ('T', public.contest_pick(5, null), now() - interval '1 minute', now() + interval '1 hour') returning id`);
    const s = await one<{ r: { id: string } }>(`select public.start_contest($1, $2, true) as r`, [U, c.id]);
    const cq = (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [s.r.id])).q[0];
    expect((await one<{ r: { ok: boolean } }>(`select public.record_answer($1, $2, $3, '{}', true, 1, 1, null) as r`, [U, s.r.id, cq])).r.ok).toBe(false);
    await expect(db.query(`select public.finish_attempt($1, $2)`, [U, s.r.id])).rejects.toThrow(/not_found/);
  });
});

describe("streak va limitlar", () => {
  it("eskirgan streak nollanadi, bugungi/kechagi — saqlanadi", async () => {
    const V = "00000000-0000-0000-0000-00000000fe02";
    const W = "00000000-0000-0000-0000-00000000fe03";
    await db.query(`insert into auth.users (id, email) values ($1, 'v@x.uz'), ($2, 'w@x.uz')`, [V, W]);
    await db.query(`update public.profiles set streak_days = 5, last_active_on = public.uz_today() - 3 where id = $1`, [V]);
    await db.query(`update public.profiles set streak_days = 4, last_active_on = public.uz_today() - 1 where id = $1`, [W]);
    const r = await one<{ n: number }>(`select public.reset_stale_streaks() as n`);
    expect(r.n).toBeGreaterThanOrEqual(1);
    const rows = (await db.query<{ id: string; streak_days: number }>(`select id, streak_days from public.profiles where id in ($1, $2) order by id`, [V, W])).rows;
    expect(rows).toEqual([{ id: V, streak_days: 0 }, { id: W, streak_days: 4 }]);
    await expect(asUser(db, U, () => db.query(`select public.reset_stale_streaks()`))).rejects.toThrow(/permission denied/);
  });

  it("reyting limiti 100 bilan cheklangan (ro'yxatni to'liq yuklab olib bo'lmaydi)", async () => {
    const fnSrc = await one<{ src: string }>(`select prosrc as src from pg_proc where proname = 'leaderboard'`);
    expect(fnSrc.src).toContain("least(greatest(p_limit, 1), 100)");
  });
});
