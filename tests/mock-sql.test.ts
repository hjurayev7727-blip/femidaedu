// Sinov imtihoni, takrorlash va kunlik test SQL funksiyalari.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { buildMockPlan, type Blueprint, type PlanItem, type PoolQuestion } from "@/lib/mock";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
let templateId: number;
let bp: Blueprint;
let pool: PoolQuestion[];

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const newUser = async (n: number) => {
  const id = `00000000-0000-0000-0000-0000000000${String(n).padStart(2, "0")}`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${n}@x.uz`]);
  return id;
};
const createMock = async (uid: string, plan: PlanItem[], limit: number | null = 1) =>
  (
    await one<{ r: { ok: boolean; id?: string; reason?: string; resumed?: boolean } }>(
      `select public.create_mock($1, $2, $3::jsonb, $4) as r`,
      [uid, templateId, JSON.stringify(plan), limit],
    )
  ).r;
const save = async (uid: string, attempt: string, q: number, resp: unknown) =>
  (await one<{ r: { ok: boolean; reason?: string } }>(`select public.save_mock_answer($1, $2, $3, $4::jsonb) as r`, [uid, attempt, q, JSON.stringify(resp)])).r;

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
  const t = await one<{ id: number; blueprint: Blueprint }>(`select id, blueprint from public.exam_templates where slug = 'milliy-sertifikat-standart'`);
  templateId = t.id;
  bp = t.blueprint;
  pool = (
    await db.query<{ id: string; type: PoolQuestion["type"]; difficulty: number; document_id: number | null }>(
      `select id, type, difficulty, document_id from public.questions where status = 'published'`,
    )
  ).rows.map((r) => ({ id: Number(r.id), type: r.type, difficulty: r.difficulty, documentId: r.document_id }));
}, 60_000);

describe("sinov imtihoni", () => {
  it("yaratiladi: 55 savol, reja saqlanadi, vaqt chegarasi = shablon davomiyligi", async () => {
    const u = await newUser(1);
    const r = await createMock(u, buildMockPlan(pool, bp));
    expect(r.ok).toBe(true);
    const a = await one<{ n: number; plan_n: number; mins: number }>(
      `select array_length(question_ids, 1) as n, jsonb_array_length(plan) as plan_n,
              round(extract(epoch from deadline_at - started_at) / 60)::int as mins
       from public.attempts where id = $1`,
      [r.id],
    );
    expect(a).toEqual({ n: 55, plan_n: 55, mins: 90 });
  });

  it("tugallanmagan sinov bo'lsa — yangisi emas, o'shani davom ettiradi", async () => {
    const u = await newUser(2);
    const first = await createMock(u, buildMockPlan(pool, bp));
    const again = await createMock(u, buildMockPlan(pool, bp));
    expect(again).toMatchObject({ ok: true, id: first.id, resumed: true });
  });

  it("oylik limit: bepul — oyiga 1 ta, Premium — cheksiz", async () => {
    const u = await newUser(3);
    const first = await createMock(u, buildMockPlan(pool, bp), 1);
    await db.query(`update public.attempts set finished_at = now() where id = $1`, [first.id]);
    expect(await createMock(u, buildMockPlan(pool, bp), 1)).toMatchObject({ ok: false, reason: "limit" });
    expect((await createMock(u, buildMockPlan(pool, bp), null)).ok).toBe(true);
  });

  it("javob saqlanadi va o'zgartiriladi; begona savol, boshqa foydalanuvchi, vaqt tugashi rad etiladi", async () => {
    const u = await newUser(4);
    const other = await newUser(5);
    const plan = buildMockPlan(pool, bp);
    const { id } = await createMock(u, plan);
    const q = plan[0].q;
    expect((await save(u, id!, q, { index: 1 })).ok).toBe(true);
    expect((await save(u, id!, q, { index: 2 })).ok).toBe(true);
    const saved = await one<{ response: { index: number }; n: number }>(
      `select response, (select count(*)::int from public.attempt_answers where attempt_id = $1) as n
       from public.attempt_answers where attempt_id = $1 and question_id = $2`,
      [id, q],
    );
    expect(saved).toEqual({ response: { index: 2 }, n: 1 });
    expect(await save(u, id!, 999999, { index: 0 })).toMatchObject({ ok: false, reason: "not_in_attempt" });
    expect(await save(other, id!, q, { index: 0 })).toMatchObject({ ok: false, reason: "not_found" });

    await db.query(`update public.attempts set deadline_at = now() - interval '1 minute' where id = $1`, [id]);
    expect(await save(u, id!, plan[1].q, { index: 0 })).toMatchObject({ ok: false, reason: "expired" });
  });

  it("yakunlash: ball, daraja, xatolar takrorlash navbatiga; qayta yakunlash hech narsani buzmaydi", async () => {
    const u = await newUser(6);
    const plan = buildMockPlan(pool, bp);
    const { id } = await createMock(u, plan);
    await save(u, id!, plan[0].q, { index: 0 });
    await save(u, id!, plan[1].q, { index: 0 });
    const results = [
      { q: plan[0].q, correct: true, points: plan[0].points },
      { q: plan[1].q, correct: false, points: 0 },
    ];
    const args = [u, id, JSON.stringify(results), 2.2, 1.7, null, 1, JSON.stringify({ byDoc: [] })];
    const sql = `select public.finish_mock($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb) as r`;
    expect((await one<{ r: { ok: boolean; already: boolean } }>(sql, args)).r).toEqual({ ok: true, already: false });

    const a = await one<{ raw_score: string; scaled_score: string; correct_count: number; fin: boolean }>(
      `select raw_score, scaled_score, correct_count, finished_at is not null as fin from public.attempts where id = $1`,
      [id],
    );
    expect(a).toEqual({ raw_score: "2.20", scaled_score: "1.70", correct_count: 1, fin: true });
    const rq = await one<{ n: number }>(`select count(*)::int as n from public.review_queue where user_id = $1 and question_id = $2`, [u, plan[1].q]);
    expect(rq.n).toBe(1);
    expect((await one<{ r: { already: boolean } }>(sql, args)).r.already).toBe(true);
    expect(await save(u, id!, plan[2].q, { index: 0 })).toMatchObject({ ok: false, reason: "finished" });
  });
});

describe("takrorlash va kunlik test", () => {
  it("takrorlash: faqat muddati kelgan savollar; bo'lmasa — no_questions", async () => {
    const u = await newUser(7);
    await expect(db.query(`select public.start_review($1, 10)`, [u])).rejects.toThrow(/no_questions/);
    const [q1, q2] = pool.slice(0, 2).map((q) => q.id);
    await db.query(
      `insert into public.review_queue (user_id, question_id, box, due_on) values
        ($1, $2, 1, public.uz_today()), ($1, $3, 2, public.uz_today() + 3)`,
      [u, q1, q2],
    );
    const due = await asUser(db, u, () => one<{ n: number }>(`select public.my_review_due() as n`));
    expect(due.n).toBe(1);
    const { id } = await one<{ id: string }>(`select public.start_review($1, 10) as id`, [u]);
    const a = await one<{ q: string[]; mode: string }>(`select question_ids as q, mode from public.attempts where id = $1`, [id]);
    expect(a.mode).toBe("review");
    expect(a.q.map(Number)).toEqual([q1]);
  });

  it("kunlik test: kuniga bitta urinish, hamma uchun bir xil 10 savol", async () => {
    const u = await newUser(8);
    const v = await newUser(9);
    const d1 = (await one<{ id: string }>(`select public.start_daily($1) as id`, [u])).id;
    const d2 = (await one<{ id: string }>(`select public.start_daily($1) as id`, [u])).id;
    expect(d2).toBe(d1);
    const dv = (await one<{ id: string }>(`select public.start_daily($1) as id`, [v])).id;
    const qs = async (id: string) => (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [id])).q;
    expect(await qs(dv)).toEqual(await qs(d1));
    expect(await qs(d1)).toHaveLength(10);
  });

  it("mijoz server funksiyalarini chaqira olmaydi", async () => {
    const u = await newUser(10);
    for (const sql of [
      `select public.create_mock('${u}', 1, '[]', null)`,
      `select public.save_mock_answer('${u}', gen_random_uuid(), 1, '{}')`,
      `select public.finish_mock('${u}', gen_random_uuid(), '[]', 0, 0, null, 0, '{}')`,
      `select public.start_review('${u}', 5)`,
      `select public.start_daily('${u}')`,
    ]) {
      await expect(asUser(db, u, () => db.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
});
