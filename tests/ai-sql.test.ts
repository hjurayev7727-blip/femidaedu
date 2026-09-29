import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const U = "00000000-0000-0000-0000-00000000a101";
const V = "00000000-0000-0000-0000-00000000a102";
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
  await db.query(`insert into auth.users (id, email) values ($1, 'u@x.uz'), ($2, 'v@x.uz')`, [U, V]);
}, 60_000);

describe("consume_ai_quota", () => {
  it("limitgacha ruxsat, keyin rad; null — cheksiz", async () => {
    const q = (limit: number | null) => one<{ r: boolean }>(`select public.consume_ai_quota($1, $2) as r`, [U, limit]).then((x) => x.r);
    expect(await q(2)).toBe(true);
    expect(await q(2)).toBe(true);
    expect(await q(2)).toBe(false);
    expect(await q(null)).toBe(true);
  });
});

describe("apply_ai_regrade", () => {
  async function wrongOpenAnswer(user: string) {
    const t = await one<{ id: number }>(`select id from public.topics where slug = 'hujjat-1'`);
    const q = await one<{ id: string }>(`select id from public.questions where type = 'open' and topic_id = $1 limit 1`, [t.id]);
    const a = await one<{ id: string }>(
      `insert into public.attempts (user_id, mode, topic_id, question_ids) values ($1, 'practice', $2, array[$3::bigint]) returning id`,
      [user, t.id, q.id],
    );
    await db.query(`select public.record_answer($1, $2, $3, '{"text":"boshqacha ifoda"}', false, 0, 1000, null)`, [user, a.id, q.id]);
    await db.query(`select public.finish_attempt($1, $2)`, [user, a.id]);
    return { attempt: a.id, question: Number(q.id) };
  }
  const regrade = (user: string, attempt: string, q: number, ok: boolean) =>
    one<{ r: { ok: boolean; reason?: string } }>(`select public.apply_ai_regrade($1, $2, $3, $4, '{"comment":"x"}') as r`, [user, attempt, q, ok]).then((x) => x.r);

  it("AI to'g'ri desa: javob to'g'ri, takrorlash navbatidan chiqadi, natija qayta hisoblanadi; ikkinchi marta — yo'q", async () => {
    const { attempt, question } = await wrongOpenAnswer(U);
    expect((await one<{ n: number }>(`select count(*)::int as n from public.review_queue where user_id = $1 and question_id = $2`, [U, question])).n).toBe(1);
    expect(await regrade(V, attempt, question, true)).toMatchObject({ ok: false, reason: "not_found" }); // begona
    expect((await regrade(U, attempt, question, true)).ok).toBe(true);
    const a = await one<{ correct_count: number; raw_score: string }>(`select correct_count, raw_score from public.attempts where id = $1`, [attempt]);
    expect(a).toEqual({ correct_count: 1, raw_score: "100.00" });
    expect((await one<{ n: number }>(`select count(*)::int as n from public.review_queue where user_id = $1 and question_id = $2`, [U, question])).n).toBe(0);
    expect(await regrade(U, attempt, question, true)).toMatchObject({ ok: false, reason: "already_correct" });
  });

  it("AI xato desa: fikr saqlanadi, natija o'zgarmaydi, qayta so'rab bo'lmaydi", async () => {
    const { attempt, question } = await wrongOpenAnswer(V);
    expect((await regrade(V, attempt, question, false)).ok).toBe(true);
    const ans = await one<{ is_correct: boolean; ai: unknown }>(`select is_correct, ai_feedback as ai from public.attempt_answers where attempt_id = $1`, [attempt]);
    expect(ans).toEqual({ is_correct: false, ai: { comment: "x" } });
    expect(await regrade(V, attempt, question, true)).toMatchObject({ ok: false, reason: "already_checked" });
  });

  it("mijoz chaqira olmaydi", async () => {
    await expect(asUser(db, U, () => db.query(`select public.consume_ai_quota('${U}', null)`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, U, () => db.query(`select public.apply_ai_regrade('${U}', gen_random_uuid(), 1, true, '{}')`))).rejects.toThrow(/permission denied/);
  });
});
