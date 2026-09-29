import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
let n = 0;
async function user(name: string, region: string | null = "Samarqand") {
  const id = `00000000-0000-0000-0000-0000000003${String(++n).padStart(2, "0")}`;
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `m${n}@x.uz`, JSON.stringify({ full_name: name })]);
  await db.query(`update public.profiles set region = $2 where id = $1`, [id, region]);
  return id;
}
/** Foydalanuvchi uchun mashq: `total` ta savol, shundan `correct` tasi to'g'ri */
async function practice(uid: string, total: number, correct: number) {
  const t = await one<{ id: number }>(`select id from public.topics where slug = 'modul-1'`);
  const a = await one<{ id: string }>(`select public.start_practice($1, $2, $3) as id`, [uid, t.id, total]);
  const ids = (await one<{ q: string[] }>(`select question_ids as q from public.attempts where id = $1`, [a.id])).q;
  for (const [i, q] of ids.entries()) await db.query(`select public.record_answer($1, $2, $3, '{}', $4, $5, 1, null)`, [uid, a.id, q, i < correct, i < correct ? 1 : 0]);
  await db.query(`select public.finish_attempt($1, $2)`, [uid, a.id]);
}

beforeAll(async () => {
  db = await createTestDb({ bundle: true });
}, 60_000);

describe("public_name", () => {
  it.each([["Ali Valiyev", "Ali V."], ["Ali", "Ali"], ["  ", "Ishtirokchi"], ["Ali  Valiyev Karimovich", "Ali V."]])("%s → %s", async (full, want) => {
    expect((await one<{ n: string }>(`select public.public_name($1) as n`, [full])).n).toBe(want);
  });
});

describe("reyting", () => {
  let A: string, B: string, C: string, D: string;
  beforeAll(async () => {
    A = await user("Anvar Aliyev");                 // 30 ta, 27 to'g'ri (90%)
    B = await user("Bekzod Bakirov", "Buxoro");     // 40 ta, 30 to'g'ri (75%)
    C = await user("Charos Choriyeva");              // 10 ta — reytingga kirmaydi (min 20)
    D = await user("Dilnoza Davronova");            // 25 ta, 25 to'g'ri, lekin reytingdan chiqqan
    await practice(A, 30, 27);
    await practice(B, 40, 30);
    await practice(C, 10, 10);
    await practice(D, 25, 25);
    await db.query(`update public.profiles set leaderboard_visible = false where id = $1`, [D]);
  }, 60_000);

  it("haftalik: minimal javoblar, yashirinlar chiqarilgan, qisqa ism, o'z qatorim belgilangan", async () => {
    const rows = await asUser(db, B, () => db.query<{ rank: number; name: string; answered: number; accuracy: string; score: string; is_me: boolean }>(
      `select rank, name, answered, accuracy, score, is_me from public.leaderboard('week')`).then((r) => r.rows));
    expect(rows.map((r) => r.name)).toEqual(["Anvar A.", "Bekzod B."]);
    // A: 0.7×90 + 0.3×(30/150×100)=63+6=69; B: 0.7×75 + 0.3×(40/150×100)=52.5+8=60.5
    expect(rows[0]).toMatchObject({ rank: 1, answered: 30, accuracy: "90.0", score: "69.0", is_me: false });
    expect(rows[1]).toMatchObject({ rank: 2, score: "60.5", is_me: true });
  });

  it("viloyat bo'yicha filtr", async () => {
    const rows = await asUser(db, A, () => db.query<{ name: string }>(`select name from public.leaderboard('week', 'Buxoro')`).then((r) => r.rows));
    expect(rows.map((r) => r.name)).toEqual(["Bekzod B."]);
  });

  it("umumiy reyting — kamida 100 javob (hozircha hech kim)", async () => {
    const rows = await asUser(db, A, () => db.query(`select * from public.leaderboard('all')`).then((r) => r.rows));
    expect(rows).toEqual([]);
  });

  it("o'quvchi o'zini reytingdan chiqara oladi", async () => {
    await asUser(db, A, () => db.query(`update public.profiles set leaderboard_visible = false where id = $1`, [A]));
    const rows = await asUser(db, B, () => db.query<{ name: string }>(`select name from public.leaderboard('week')`).then((r) => r.rows));
    expect(rows.map((r) => r.name)).toEqual(["Bekzod B."]);
    await db.query(`update public.profiles set leaderboard_visible = true where id = $1`, [A]);
  });
});

describe("nishonlar", () => {
  it("shartlar bajarilganda beriladi, takror berilmaydi", async () => {
    const u = await user("Nishon Olovchi");
    expect((await one<{ b: string[] }>(`select public.award_badges($1) as b`, [u])).b).toEqual([]);
    await practice(u, 50, 40);
    await practice(u, 50, 40);
    await practice(u, 5, 5);
    await db.query(`update public.profiles set streak_best = 8 where id = $1`, [u]);
    const got = (await one<{ b: string[] }>(`select public.award_badges($1) as b`, [u])).b;
    expect(got.sort()).toEqual(["first_test", "q_100", "streak_7"]);
    expect((await one<{ b: string[] }>(`select public.award_badges($1) as b`, [u])).b).toEqual([]);
  });
});

describe("musobaqa", () => {
  let contest: number;
  let X: string, Y: string, Z: string;

  beforeAll(async () => {
    X = await user("Xurshid Xolmatov");
    Y = await user("Yulduz Yusupova");
    Z = await user("Zafar Zokirov");
    contest = (
      await one<{ id: number }>(
        `insert into public.contests (title, question_ids, starts_at, ends_at, is_premium)
         values ('Blits', public.contest_pick(5, null), now() - interval '1 minute', now() + interval '30 minutes', false) returning id`,
      )
    ).id;
  });

  const start = (u: string, premium = false) =>
    one<{ r: { ok: boolean; id?: string; reason?: string } }>(`select public.start_contest($1, $2, $3) as r`, [u, contest, premium]).then((x) => x.r);

  it("savollar ro'yxati mijozga ochiq emas; ishtirokchilar soni ko'rinadi", async () => {
    await expect(asUser(db, X, () => db.query(`select question_ids from public.contests`))).rejects.toThrow(/permission denied/);
    const rows = await asUser(db, X, () => db.query(`select id, title from public.contests`).then((r) => r.rows));
    expect(rows).toHaveLength(1);
  });

  it("qatnashish: bitta urinish; boshlanmagan / tugagan / premium — rad", async () => {
    const x1 = await start(X);
    expect(x1.ok).toBe(true);
    expect((await start(X)).id).toBe(x1.id);
    await start(Y);
    await start(Z);
    expect((await asUser(db, X, () => one<{ n: number }>(`select public.contest_participants($1) as n`, [contest]))).n).toBe(3);

    const future = (await one<{ id: number }>(`insert into public.contests (title, question_ids, starts_at, ends_at, is_premium)
      values ('Keyin', '{1}', now() + interval '1 day', now() + interval '2 days', true) returning id`)).id;
    expect((await one<{ r: { reason: string } }>(`select public.start_contest($1, $2, true) as r`, [X, future])).r.reason).toBe("not_started");
    await db.query(`update public.contests set starts_at = now() - interval '1 hour' where id = $1`, [future]);
    expect((await one<{ r: { reason: string } }>(`select public.start_contest($1, $2, false) as r`, [X, future])).r.reason).toBe("premium");
  });

  it("erta tugatish faqat yopadi: baho va javoblar musobaqa tugaguncha ko'rinmaydi; tugagach — to'g'ri javob ↓, vaqt ↑", async () => {
    const entries = (await db.query<{ user_id: string; attempt_id: string }>(`select user_id, attempt_id from public.contest_entries where contest_id = $1`, [contest])).rows;
    const byUser = new Map(entries.map((e) => [e.user_id, e.attempt_id]));
    const qs = (await one<{ q: string[] }>(`select question_ids as q from public.contests where id = $1`, [contest])).q.map(Number);
    const answerAndClose = async (u: string, secondsAgo: number) => {
      const att = byUser.get(u)!;
      for (const q of qs) await db.query(`select public.save_mock_answer($1, $2, $3, '{"index":0}')`, [u, att, q]);
      await db.query(`update public.attempts set started_at = now() - make_interval(secs => $2) where id = $1`, [att, secondsAgo]);
      await db.query(`select public.close_contest_attempt($1, $2)`, [u, att]);
    };
    await answerAndClose(X, 300);
    await answerAndClose(Y, 120);
    await answerAndClose(Z, 60);

    // musobaqa davom etmoqda: baholash rad etiladi, o'z javoblari (is_correct) va natija ustunlari ko'rinmaydi
    const attX = byUser.get(X)!;
    const early = await one<{ r: { ok: boolean; reason: string } }>(`select public.finish_contest_attempt($1, '[]') as r`, [attX]);
    expect(early.r).toMatchObject({ ok: false, reason: "not_ended" });
    const visible = await asUser(db, X, () => db.query(`select * from public.attempt_answers where attempt_id = $1`, [attX]).then((r) => r.rows));
    expect(visible).toEqual([]);
    await expect(asUser(db, X, () => db.query(`select correct from public.contest_entries`))).rejects.toThrow(/permission denied/);
    expect(await asUser(db, X, () => db.query(`select * from public.contest_results($1)`, [contest]).then((r) => r.rows))).toEqual([]);

    // tugadi → baholash → yakunlash
    await db.query(`update public.contests set ends_at = now() - interval '1 second' where id = $1`, [contest]);
    expect((await one<{ r: { reason: string } }>(`select public.finalize_contest($1) as r`, [contest])).r.reason).toBe("ungraded");
    const grade = (u: string, correct: number) =>
      db.query(`select public.finish_contest_attempt($1, $2::jsonb)`, [byUser.get(u), JSON.stringify(qs.map((q, i) => ({ q, correct: i < correct })))]);
    await grade(X, 4);
    await grade(Y, 4);
    await grade(Z, 2);
    expect((await one<{ r: { ok: boolean } }>(`select public.finalize_contest($1) as r`, [contest])).r.ok).toBe(true);

    const res = await asUser(db, X, () => db.query<{ rank: number; name: string; correct: number; is_me: boolean }>(
      `select rank, name, correct, is_me from public.contest_results($1)`, [contest]).then((r) => r.rows));
    expect(res).toEqual([
      { rank: 1, name: "Yulduz Y.", correct: 4, is_me: false },
      { rank: 2, name: "Xurshid X.", correct: 4, is_me: true },
      { rank: 3, name: "Zafar Z.", correct: 2, is_me: false },
    ]);
    const after = await asUser(db, X, () => db.query(`select is_correct from public.attempt_answers where attempt_id = $1`, [attX]).then((r) => r.rows));
    expect(after).toHaveLength(qs.length);
    expect((await one<{ b: string[] }>(`select public.award_badges($1) as b`, [Y])).b).toContain("contest_top3");
  });

  it("mijoz server funksiyalarini chaqira olmaydi va boshqalarning yozuvlarini ko'rmaydi", async () => {
    await expect(asUser(db, X, () => db.query(`select public.start_contest('${X}', 1, true)`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, X, () => db.query(`select public.award_badges('${X}')`))).rejects.toThrow(/permission denied/);
    const mine = await asUser(db, X, () => db.query<{ user_id: string }>(`select user_id from public.contest_entries`).then((r) => r.rows));
    expect(mine.every((r) => r.user_id === X)).toBe(true);
  });
});
