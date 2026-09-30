// Foydalanuvchi testlari: yaratish, limit, ulashish/ruxsat, mehmon, muddat, javob kaliti o'zgarsa qayta hisoblash, reyting, katalog.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const OWNER = "00000000-0000-0000-0000-0000000a0001";
const STUDENT = "00000000-0000-0000-0000-0000000a0002";
const OTHER = "00000000-0000-0000-0000-0000000a0003";
const ADMIN = "00000000-0000-0000-0000-0000000a0004";
const GUEST = "guesthash-1";

type J = Record<string, unknown>;
const one = async <T = J>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0].r;

const item = (i: number, extra: J = {}) => ({
  type: "single", stem: `Savol ${i}`, payload: { options: ["A", "B", "C", "D"] }, answer: { index: 0 },
  explanation: i % 2 ? `Izoh ${i}` : "", fingerprint: `fp${i}`, ...extra,
});
const createTest = (items: J[], extra: J = {}) =>
  one<{ id: number; share_code: string; items: number }>(`select public.create_user_test($1, $2::jsonb) as r`,
    [OWNER, JSON.stringify({ title: "Mehnat kodeksi", field: "mehnat", items, ...extra })]);
const publish = (test: number, visibility: string, settings: J = {}, group: number | null = null) =>
  one<J>(`select public.publish_test($1, $2, $3::test_visibility, $4, $5::jsonb) as r`, [OWNER, test, visibility, group, JSON.stringify(settings)]);
const start = (code: string, user: string | null, guestName: string | null = null, guest: string | null = null) =>
  one<{ ok: boolean; attempt_id?: string; reason?: string; resumed?: boolean }>(`select public.start_test_attempt($1, $2, $3, $4) as r`, [code, user, guestName, guest]);
const answer = (attempt: string, user: string | null, guest: string | null, itemId: number, correct: boolean) =>
  one<{ ok: boolean; reason?: string }>(`select public.save_test_answer($1, $2, $3, $4, '{"index":0}'::jsonb, $5) as r`, [attempt, user, guest, itemId, correct]);
const finish = (attempt: string, user: string | null, guest: string | null = null) =>
  one<{ ok: boolean; score: number; correct: number; total: number }>(`select public.finish_test_attempt($1, $2, $3) as r`, [attempt, user, guest]);
const itemIds = async (test: number) => (await db.query<{ id: number }>(`select id from test_items where test_id = $1 order by pos`, [test])).rows.map((r) => Number(r.id));

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values
    ($1, 'o@x.uz', '{"full_name":"Muallif Aka"}'), ($2, 's@x.uz', '{"full_name":"Ali Valiyev"}'), ($3, 'x@x.uz', '{}'), ($4, 'a@x.uz', '{}')`,
    [OWNER, STUDENT, OTHER, ADMIN]);
  await db.query(`update profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`update profiles set full_name = 'Muallif Aka' where id = $1`, [OWNER]);
  await db.query(`update profiles set full_name = 'Ali Valiyev' where id = $1`, [STUDENT]);
});

describe("AI haftalik limiti", () => {
  it("bepul — 10 ta, keyin null; qaytarish ishlaydi", async () => {
    const q = () => one<number | null>(`select public.consume_test_quota($1, 10) as r`, [OTHER]);
    for (let i = 1; i <= 10; i++) expect(await q()).toBe(i);
    expect(await q()).toBeNull();
    await db.query(`select public.refund_test_quota($1)`, [OTHER]);
    expect(await q()).toBe(10);
  });
});

describe("yaratish va tahrirlash", () => {
  it("takroriy savol o'tkazib yuboriladi, kod 6 belgi va chalkash belgilarsiz, moddasiz — own_material", async () => {
    const t = await createTest([item(1), item(2), item(1)]);
    expect(t.items).toBe(2);
    expect(t.share_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const row = (await db.query<{ own_material: boolean; status: string }>(`select own_material, status from tests where id = $1`, [t.id])).rows[0];
    expect(row).toEqual({ own_material: true, status: "draft" });
  });

  it("50 dan ortiq savol rad etiladi", async () => {
    await expect(createTest(Array.from({ length: 51 }, (_, i) => item(i)))).rejects.toThrow(/items_count/);
  });

  it("qoralama test kod bilan ochilmaydi; boshqa foydalanuvchi tahrirlay olmaydi", async () => {
    const t = await createTest([item(1)]);
    expect(await start(t.share_code, STUDENT)).toEqual({ ok: false, reason: "not_found" });
    const r = await one<J>(`select public.save_test_item($1, $2, null, $3::jsonb) as r`, [OTHER, t.id, JSON.stringify(item(9))]);
    expect(r).toEqual({ ok: false, reason: "not_found" });
  });

  it("server funksiyalarini klient to'g'ridan-to'g'ri chaqira olmaydi, javob kaliti o'qilmaydi", async () => {
    await expect(asUser(db, STUDENT, () => db.query(`select public.start_test_attempt('AAAAAA', $1, null, null)`, [STUDENT]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, STUDENT, () => db.query(`select answer from test_items`))).rejects.toThrow(/permission denied/);
    const own = await asUser(db, OWNER, async () => (await db.query(`select id from tests`)).rows.length);
    const other = await asUser(db, STUDENT, async () => (await db.query(`select id from tests`)).rows.length);
    expect(own).toBeGreaterThan(0);
    expect(other).toBe(0);
  });
});

describe("ulashish va ishlash", () => {
  it("havola: kirgan va mehmon ishlaydi; muallif to'liq ismni ko'radi; ball hisoblanadi", async () => {
    const t = await createTest([item(1), item(2), item(3), item(4)]);
    expect(await publish(t.id, "link", { reveal: "end" })).toMatchObject({ ok: true });
    const ids = await itemIds(t.id);

    const s = await start(t.share_code.toLowerCase(), STUDENT);
    expect(s.ok).toBe(true);
    expect(await start(t.share_code, STUDENT)).toMatchObject({ ok: true, attempt_id: s.attempt_id, resumed: true });
    await answer(s.attempt_id!, STUDENT, null, ids[0], true);
    await answer(s.attempt_id!, STUDENT, null, ids[1], false);
    expect(await answer(s.attempt_id!, STUDENT, null, ids[1], true)).toEqual({ ok: true, reveal: "end" }); // yakunlaguncha o'zgartirish mumkin
    expect(await answer(s.attempt_id!, OTHER, null, ids[2], true)).toEqual({ ok: false, reason: "not_found" });
    expect(await finish(s.attempt_id!, STUDENT)).toMatchObject({ score: 50, correct: 2, total: 4 });
    expect(await answer(s.attempt_id!, STUDENT, null, ids[2], true)).toEqual({ ok: false, reason: "finished" });

    expect(await start(t.share_code, null)).toEqual({ ok: false, reason: "login_required" }); // ismsiz mehmon
    const g = await start(t.share_code, null, "Mehmon Bola", GUEST);
    await answer(g.attempt_id!, null, GUEST, ids[0], true);
    expect(await answer(g.attempt_id!, null, "boshqa-token", ids[1], true)).toEqual({ ok: false, reason: "not_found" });
    expect(await finish(g.attempt_id!, null, GUEST)).toMatchObject({ score: 25 });

    const res = (await db.query<{ name: string; guest: boolean; score: string }>(`select name, guest, score from public.test_results($1, $2)`, [OWNER, t.id])).rows;
    expect(res.map((r) => [r.name, r.guest, r.score]).sort()).toEqual([["Ali Valiyev", false, "50.00"], ["Mehmon Bola", true, "25.00"]]);
    expect((await db.query(`select * from public.test_results($1, $2)`, [OTHER, t.id])).rows).toHaveLength(0);
    const stats = (await db.query<{ answered: number; correct: number }>(`select answered, correct from public.test_item_stats($1, $2) order by item_id`, [OWNER, t.id])).rows;
    expect(stats[0]).toEqual({ answered: 2, correct: 2 });

    // mehmon keyin kirsa — urinishi akkauntga o'tadi
    expect(await one<number>(`select public.claim_guest_attempts($1, $2) as r`, [OTHER, GUEST])).toBe(1);
  });

  it("reveal=each — javob o'zgartirilmaydi", async () => {
    const t = await createTest([item(1)]);
    await publish(t.id, "link", { reveal: "each" });
    const [id] = await itemIds(t.id);
    const s = await start(t.share_code, STUDENT);
    expect(await answer(s.attempt_id!, STUDENT, null, id, false)).toEqual({ ok: true, reveal: "each" });
    expect(await answer(s.attempt_id!, STUDENT, null, id, true)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("muddat, urinishlar soni va mehmonga yopiq test", async () => {
    const t = await createTest([item(1)]);
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 1000).toISOString();
    await publish(t.id, "link", { opens_at: future });
    expect(await start(t.share_code, STUDENT)).toEqual({ ok: false, reason: "not_open" });
    await publish(t.id, "link", { closes_at: past });
    expect(await start(t.share_code, STUDENT)).toEqual({ ok: false, reason: "closed" });
    await publish(t.id, "link", { max_attempts: 1, guests: false, timer_min: 20 });
    expect(await start(t.share_code, null, "Mehmon", GUEST)).toEqual({ ok: false, reason: "login_required" });
    const s = await start(t.share_code, STUDENT);
    const dl = (await db.query<{ m: number }>(`select extract(epoch from deadline_at - started_at) / 60 as m from test_attempts where id = $1`, [s.attempt_id])).rows[0];
    expect(Math.round(Number(dl.m))).toBe(20);
    await finish(s.attempt_id!, STUDENT);
    expect(await start(t.share_code, STUDENT)).toEqual({ ok: false, reason: "max_attempts" });
    expect((await start(t.share_code, OWNER)).ok).toBe(true); // muallif cheklanmaydi
  });

  it("vaqt tugagach javob qabul qilinmaydi", async () => {
    const t = await createTest([item(1)]);
    await publish(t.id, "link", {});
    const [id] = await itemIds(t.id);
    const s = await start(t.share_code, STUDENT);
    await db.query(`update test_attempts set deadline_at = now() - interval '1 minute' where id = $1`, [s.attempt_id]);
    expect(await answer(s.attempt_id!, STUDENT, null, id, true)).toEqual({ ok: false, reason: "time_up" });
  });

  it("guruh testi: faqat a'zolar; boshqa o'qituvchi guruhiga berib bo'lmaydi", async () => {
    const g = (await db.query<{ id: number }>(`insert into groups (teacher_id, name) values ($1, 'G1') returning id`, [OWNER])).rows[0].id;
    const foreign = (await db.query<{ id: number }>(`insert into groups (teacher_id, name) values ($1, 'G2') returning id`, [OTHER])).rows[0].id;
    await db.query(`insert into group_members (group_id, user_id) values ($1, $2)`, [g, STUDENT]);
    const t = await createTest([item(1)]);
    expect(await publish(t.id, "group", {}, foreign)).toEqual({ ok: false, reason: "group" });
    expect(await publish(t.id, "group", {}, g)).toMatchObject({ ok: true });
    expect((await start(t.share_code, STUDENT)).ok).toBe(true);
    expect(await start(t.share_code, OTHER)).toEqual({ ok: false, reason: "not_found" });
    expect(await start(t.share_code, null, "M", GUEST)).toEqual({ ok: false, reason: "login_required" });
    const card = await one<J>(`select public.test_card($1, $2, null) as r`, [t.share_code, OTHER]);
    expect(card).toMatchObject({ ok: false, reason: "group_only" });
    const mine = await asUser(db, STUDENT, async () => (await db.query<{ code: string }>(`select code from public.my_group_tests()`)).rows);
    expect(mine.map((r) => r.code)).toContain(t.share_code);
  });
});

describe("javob kaliti o'zgarishi", () => {
  it("key_version oshadi, ballar jimgina qayta hisoblanadi, eski ball tarixda", async () => {
    const t = await createTest([item(1), item(2)]);
    await publish(t.id, "link", {});
    const ids = await itemIds(t.id);
    const s = await start(t.share_code, STUDENT);
    await answer(s.attempt_id!, STUDENT, null, ids[0], false);
    await answer(s.attempt_id!, STUDENT, null, ids[1], true);
    expect(await finish(s.attempt_id!, STUDENT)).toMatchObject({ score: 50 });

    const r = await one<J>(`select public.save_test_item($1, $2, $3, $4::jsonb, $5::jsonb) as r`,
      [OWNER, t.id, ids[0], JSON.stringify(item(1, { answer: { index: 2 } })), JSON.stringify([{ attempt_id: s.attempt_id, correct: true }])]);
    expect(r).toMatchObject({ ok: true, regraded: true });
    const a = (await db.query<{ score: string; score_history: { score: number; reason: string }[] }>(`select score, score_history from test_attempts where id = $1`, [s.attempt_id])).rows[0];
    expect(a.score).toBe("100.00");
    expect(a.score_history).toEqual([expect.objectContaining({ score: 50, reason: "key_change" })]);
    expect((await db.query<{ key_version: number }>(`select key_version from test_items where id = $1`, [ids[0]])).rows[0].key_version).toBe(2);

    // javob berilgan savol turi o'zgarmaydi
    const locked = await one<J>(`select public.save_test_item($1, $2, $3, $4::jsonb) as r`,
      [OWNER, t.id, ids[0], JSON.stringify(item(1, { type: "open", payload: { kind: "text" }, answer: { accepted: ["x"], show: "x" } }))]);
    expect(locked).toEqual({ ok: false, reason: "type_locked" });

    // javob berilgan savolni olib tashlash — bekor qilinadi, ball qayta hisoblanadi (1/1)
    await one(`select public.remove_test_item($1, $2) as r`, [OWNER, ids[1]]);
    const after = (await db.query<{ score: string; total_count: number }>(`select score, total_count from test_attempts where id = $1`, [s.attempt_id])).rows[0];
    expect(after).toEqual({ score: "100.00", total_count: 1 });
  });
});

describe("reyting, ishonch va katalog", () => {
  it("baho faqat yakunlagandan keyin; muallif o'ziga baho qo'ymaydi", async () => {
    const t = await createTest([item(1)]);
    await publish(t.id, "link", {});
    expect(await one<boolean>(`select public.rate_test($1, $2, 5) as r`, [STUDENT, t.id])).toBe(false);
    const s = await start(t.share_code, STUDENT);
    await finish(s.attempt_id!, STUDENT);
    expect(await one<boolean>(`select public.rate_test($1, $2, 5) as r`, [STUDENT, t.id])).toBe(true);
    expect(await one<boolean>(`select public.rate_test($1, $2, 3) as r`, [STUDENT, t.id])).toBe(true);
    expect(await one<boolean>(`select public.rate_test($1, $2, 5) as r`, [OWNER, t.id])).toBe(false);
    const row = (await db.query<{ rating_sum: number; rating_n: number }>(`select rating_sum, rating_n from tests where id = $1`, [t.id])).rows[0];
    expect(row).toEqual({ rating_sum: 3, rating_n: 1 });
  });

  it("katalog: ishonch ≥ 1, moderatsiya ok, bazaga bog'langan, ≥ 5 savol, izohli ≥ 50%", async () => {
    await db.query(`insert into documents (number, code, title, short_title, field_id) values (900, 'TK', 'TK', 'TK', (select id from fields where slug = 'mehnat'))`);
    const docId = (await db.query<{ id: number }>(`select id from documents where code = 'TK'`)).rows[0].id;
    const artId = (await db.query<{ id: number }>(`insert into articles (document_id, number, title, body) values ($1, '1', 'M1', 'matn') returning id`, [docId])).rows[0].id;
    const t = await createTest(Array.from({ length: 5 }, (_, i) => item(100 + i, { article_id: artId, explanation: "izoh" })));
    await publish(t.id, "public", {});
    const codes = async () => (await db.query<{ code: string }>(`select code from public.test_catalog('mehnat', 50)`)).rows.map((r) => r.code);
    expect(await codes()).not.toContain(t.share_code); // moderatsiya kutilmoqda, ishonch 0
    await db.query(`select public.set_test_moderation($1, 'ok', null)`, [t.id]);
    expect(await codes()).not.toContain(t.share_code);
    expect(await one<boolean>(`select public.admin_set_trust($1, $2, 1) as r`, [STUDENT, OWNER])).toBe(false); // admin emas
    expect(await one<boolean>(`select public.admin_set_trust($1, $2, 1) as r`, [ADMIN, OWNER])).toBe(true);
    expect(await codes()).toContain(t.share_code);
    const anon = await asUser(db, OTHER, async () => (await db.query(`select * from public.test_catalog(null, 10)`)).rows.length);
    expect(anon).toBeGreaterThan(0);
  });

  it("foydalanuvchi o'z ishonch darajasini o'zgartira olmaydi", async () => {
    await expect(asUser(db, STUDENT, () => db.query(`update profiles set trust_level = 3 where id = $1`, [STUDENT]))).rejects.toThrow(/permission denied/);
  });

  it("kirgan foydalanuvchining javobi modda progressiga yoziladi", async () => {
    const artId = (await db.query<{ id: number }>(`select id from articles where title = 'M1'`)).rows[0].id;
    const t = await createTest([item(200, { article_id: artId })]);
    await publish(t.id, "link", {});
    const [id] = await itemIds(t.id);
    const s = await start(t.share_code, STUDENT);
    await answer(s.attempt_id!, STUDENT, null, id, true);
    const p = (await db.query<{ seen: number; correct: number }>(`select seen, correct from article_progress where user_id = $1 and article_id = $2`, [STUDENT, artId])).rows[0];
    expect(p).toEqual({ seen: 1, correct: 1 });
  });
});
