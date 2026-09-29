// O'qituvchi paneli: qo'shilish, statistika, zaif mavzular, vazifalar, admin amallari.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const T = "00000000-0000-0000-0000-00000000c001"; // o'qituvchi
const T2 = "00000000-0000-0000-0000-00000000c002"; // boshqa o'qituvchi
const S1 = "00000000-0000-0000-0000-00000000c011";
const S2 = "00000000-0000-0000-0000-00000000c012";
const OUT = "00000000-0000-0000-0000-00000000c013"; // guruhga kirmagan
const ADMIN = "00000000-0000-0000-0000-00000000c0ad";
let group: { id: number; invite_code: string };
let assignment: number;

const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
const rpc = async <T>(sql: string, params: unknown[] = []) => (await one<{ r: T }>(sql, params)).r;

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
  for (const [id, name] of [[T, "Ustoz"], [T2, "Boshqa ustoz"], [S1, "Ali"], [S2, "Vali"], [OUT, "Begona"], [ADMIN, "Admin"]]) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${id.slice(-4)}@x.uz`, JSON.stringify({ full_name: name })]);
  }
  await db.query(`update public.profiles set role = 'teacher' where id in ($1, $2)`, [T, T2]);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
  group = await asUser(db, T, () =>
    one<{ id: number; invite_code: string }>(`insert into public.groups (teacher_id, name) values ($1, '11-A') returning id, invite_code`, [T]),
  );
}, 60_000);

describe("guruhga qo'shilish", () => {
  it("taklif kodi bo'yicha guruh ma'lumoti va qo'shilish (takror qo'shilish — xato emas)", async () => {
    const info = await asUser(db, S1, () => one<{ name: string; teacher_name: string }>(`select * from public.group_by_invite($1)`, [group.invite_code]));
    expect(info).toMatchObject({ name: "11-A", teacher_name: "Ustoz" });
    expect(await rpc(`select public.join_group($1, $2) as r`, [S1, group.invite_code])).toMatchObject({ ok: true });
    expect(await rpc(`select public.join_group($1, $2) as r`, [S1, group.invite_code])).toMatchObject({ ok: true });
    expect(await rpc(`select public.join_group($1, $2) as r`, [S2, group.invite_code])).toMatchObject({ ok: true });
    expect(await rpc(`select public.join_group($1, 'yoq') as r`, [S2])).toMatchObject({ ok: false, reason: "not_found" });
    expect(await rpc(`select public.join_group($1, $2) as r`, [T, group.invite_code])).toMatchObject({ ok: false, reason: "own" });
    const { n } = await one<{ n: number }>(`select count(*)::int as n from public.group_members where group_id = $1`, [group.id]);
    expect(n).toBe(2);
  });

  it("o'quvchi o'zi qo'shila olmaydi (faqat server orqali)", async () => {
    await expect(
      asUser(db, OUT, () => db.query(`insert into public.group_members (group_id, user_id) values ($1, $2)`, [group.id, OUT])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("vazifalar", () => {
  it("o'qituvchi vazifa yaratadi; a'zo boshlaydi (bitta urinish), begona — yo'q", async () => {
    const topic = await one<{ id: number }>(`select id from public.topics where slug = 'hujjat-2'`);
    assignment = (
      await asUser(db, T, () =>
        one<{ id: number }>(
          `insert into public.assignments (group_id, title, mode, topic_id, question_count, due_at)
           values ($1, 'Bayroq qonuni', 'assignment', $2, 5, now() + interval '3 days') returning id`,
          [group.id, topic.id],
        ),
      )
    ).id;
    await expect(
      asUser(db, T2, () => db.query(`insert into public.assignments (group_id, title, mode) values ($1, 'X', 'assignment')`, [group.id])),
    ).rejects.toThrow(/row-level security/);

    const a1 = await rpc<{ ok: boolean; id: string }>(`select public.start_assignment($1, $2) as r`, [S1, assignment]);
    expect(a1.ok).toBe(true);
    const again = await rpc<{ id: string }>(`select public.start_assignment($1, $2) as r`, [S1, assignment]);
    expect(again.id).toBe(a1.id);
    expect(await rpc(`select public.start_assignment($1, $2) as r`, [OUT, assignment])).toMatchObject({ ok: false, reason: "not_member" });

    const att = await one<{ n: number; mode: string }>(`select array_length(question_ids, 1) as n, mode from public.attempts where id = $1`, [a1.id]);
    expect(att).toEqual({ n: 5, mode: "assignment" });

    // S1 3 ta to'g'ri, 2 ta xato javob beradi va yakunlaydi
    const ids = (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [a1.id])).q;
    for (const [i, q] of ids.entries()) {
      await db.query(`select public.record_answer($1, $2, $3, '{"index":0}', $4, $5, 1000, null)`, [S1, a1.id, q, i < 3, i < 3 ? 1 : 0]);
    }
    await db.query(`select public.finish_attempt($1, $2)`, [S1, a1.id]);
  });

  it("bajarilish: o'qituvchi ko'radi (done / new), boshqa o'qituvchi — forbidden", async () => {
    const rows = await asUser(db, T, () =>
      db.query<{ full_name: string; status: string; correct: number; score: string }>(`select full_name, status, correct, score from public.assignment_progress($1)`, [assignment]).then((r) => r.rows),
    );
    expect(rows).toEqual([
      { full_name: "Ali", status: "done", correct: 3, score: "60.00" },
      { full_name: "Vali", status: "new", correct: null, score: null },
    ]);
    await expect(asUser(db, T2, () => db.query(`select * from public.assignment_progress($1)`, [assignment]))).rejects.toThrow(/forbidden/);
  });

  it("o'quvchi o'z vazifalarini ko'radi, begona — yo'q", async () => {
    const mine = await asUser(db, S1, () => db.query<{ title: string; finished: boolean }>(`select title, finished from public.my_assignments()`).then((r) => r.rows));
    expect(mine).toEqual([{ title: "Bayroq qonuni", finished: true }]);
    const out = await asUser(db, OUT, () => db.query(`select * from public.my_assignments()`).then((r) => r.rows));
    expect(out).toEqual([]);
  });
});

describe("statistika", () => {
  it("guruh statistikasi va zaif mavzular — faqat egasi va admin", async () => {
    const rows = await asUser(db, T, () =>
      db.query<{ full_name: string; answered_7d: number; correct_total: number }>(`select full_name, answered_7d, correct_total from public.group_stats($1)`, [group.id]).then((r) => r.rows),
    );
    expect(rows).toEqual([
      { full_name: "Ali", answered_7d: 5, correct_total: 3 },
      { full_name: "Vali", answered_7d: 0, correct_total: 0 },
    ]);
    const asAdmin = await asUser(db, ADMIN, () => db.query(`select * from public.group_stats($1)`, [group.id]).then((r) => r.rows));
    expect(asAdmin).toHaveLength(2);
    await expect(asUser(db, T2, () => db.query(`select * from public.group_stats($1)`, [group.id]))).rejects.toThrow(/forbidden/);
    await expect(asUser(db, S1, () => db.query(`select * from public.group_weak_topics($1)`, [group.id]))).rejects.toThrow(/forbidden/);
  });

  it("zaif mavzular: kamida 10 javob bo'lgan hujjatlar, eng past foiz birinchi", async () => {
    // Vali Davlat gerbi (№3) bo'yicha 10 ta savolga 2 ta to'g'ri javob beradi
    const topic = await one<{ id: number }>(`select id from public.topics where slug = 'hujjat-3'`);
    const a = await one<{ id: string }>(`select public.start_practice($1, $2, 10) as id`, [S2, topic.id]);
    const ids = (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [a.id])).q;
    for (const [i, q] of ids.entries()) await db.query(`select public.record_answer($1, $2, $3, '{}', $4, $5, 1, null)`, [S2, a.id, q, i < 2, i < 2 ? 1 : 0]);
    const weak = await asUser(db, T, () => db.query<{ document_number: number; answered: number; correct: number }>(`select document_number, answered, correct from public.group_weak_topics($1)`, [group.id]).then((r) => r.rows));
    expect(weak).toEqual([{ document_number: 3, answered: 10, correct: 2 }]); // №2 da atigi 5 javob — ko'rsatilmaydi
  });
});

describe("admin amallari", () => {
  it("rol, Premium sovg'a, guruh Premium — faqat admin", async () => {
    expect((await one<{ r: boolean }>(`select public.admin_set_role($1, $2, 'teacher') as r`, [T, S2])).r).toBe(false);
    expect((await one<{ r: boolean }>(`select public.admin_set_role($1, $2, 'teacher') as r`, [ADMIN, S2])).r).toBe(true);
    expect((await one<{ r: boolean }>(`select public.admin_set_role($1, $1, 'student') as r`, [ADMIN])).r).toBe(false);

    expect((await one<{ r: boolean }>(`select public.admin_grant_premium($1, $2, 1) as r`, [ADMIN, OUT])).r).toBe(true);
    expect(await asUser(db, OUT, () => one<{ p: boolean }>(`select public.is_premium() as p`).then((r) => r.p))).toBe(true);

    expect(await asUser(db, S1, () => one<{ p: boolean }>(`select public.is_premium() as p`).then((r) => r.p))).toBe(false);
    expect((await one<{ r: boolean }>(`select public.admin_set_group_premium($1, $2, true) as r`, [ADMIN, group.id])).r).toBe(true);
    expect(await asUser(db, S1, () => one<{ p: boolean }>(`select public.is_premium() as p`).then((r) => r.p))).toBe(true);
  });

  it("mijoz server funksiyalarini chaqira olmaydi", async () => {
    for (const sql of [
      `select public.join_group('${OUT}', 'x')`,
      `select public.start_assignment('${OUT}', 1)`,
      `select public.admin_set_role('${OUT}', '${OUT}', 'admin')`,
      `select public.admin_grant_premium('${OUT}', '${OUT}', 12)`,
    ]) {
      await expect(asUser(db, OUT, () => db.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
});
