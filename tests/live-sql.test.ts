// Jonli viktorina: xona, PIN, qo'shilish (mehmon ham), limit, savol oqimi, ball, javob kaliti faqat reveal'da.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const HOST = "00000000-0000-0000-0000-0000000c0001";
const P1 = "00000000-0000-0000-0000-0000000c0002";
const OTHER = "00000000-0000-0000-0000-0000000c0003";
type J = Record<string, unknown>;
const one = async <T = J>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0].r;
let testId = 0;
let items: number[] = [];

const create = (max = 30, host = HOST, test = () => testId) =>
  one<{ ok: boolean; room_id: string; pin: string; reason?: string }>(`select public.create_live_room($1, $2, 20, $3, null) as r`, [host, test(), max]);
const join = (pin: string, user: string | null, guest: string | null, name: string) =>
  one<{ ok: boolean; player_id?: string; reason?: string }>(`select public.join_live_room($1, $2, $3, $4) as r`, [pin, user, guest, name]);
const state = (room: string, user: string | null, guest: string | null, host = false) =>
  one<J & { status: string; me?: J; top?: J[]; answer?: J | null; item?: J | null }>(`select public.live_state($1, $2, $3, $4) as r`, [room, user, guest, host]);
const answer = (room: string, user: string | null, guest: string | null, item: number, correct: boolean) =>
  one<J>(`select public.live_answer($1, $2, $3, $4, '{"index":0}'::jsonb, $5) as r`, [room, user, guest, item, correct]);

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'h@x.uz'), ($2, 'p@x.uz'), ($3, 'o@x.uz')`, [HOST, P1, OTHER]);
  const t = await one<{ id: number }>(`select public.create_user_test($1, $2::jsonb) as r`, [HOST, JSON.stringify({
    title: "Jonli test",
    items: [1, 2].map((i) => ({ type: "single", stem: `Savol ${i}`, payload: { options: ["A", "B"] }, answer: { index: 0 }, fingerprint: `l${i}` })),
  })]);
  testId = t.id;
  items = (await db.query<{ id: number }>(`select id from test_items where test_id = $1 order by pos`, [testId])).rows.map((r) => Number(r.id));
});

describe("jonli viktorina", () => {
  it("faqat test egasi xona ochadi; PIN 6 raqam", async () => {
    expect(await create(30, OTHER)).toEqual({ ok: false, reason: "not_found" });
    const r = await create();
    expect(r.pin).toMatch(/^\d{6}$/);
  });

  it("to'liq oqim: qo'shilish, savol, ball, reveal, top, yakun", async () => {
    const room = await create(2);
    expect((await join(room.pin, P1, null, "Ali Valiyev")).ok).toBe(true);
    expect((await join(room.pin, P1, null, "Boshqa ism")).ok).toBe(true); // qayta kirish — o'sha ishtirokchi
    expect(await join(room.pin, null, "g1", "M")).toEqual({ ok: false, reason: "name" });
    expect((await join(room.pin, null, "g1", "Mehmon Bola")).ok).toBe(true);
    expect(await join(room.pin, OTHER, null, "Uchinchi")).toEqual({ ok: false, reason: "full" }); // limit 2

    const lobby = await state(room.room_id, HOST, null, true);
    expect(lobby).toMatchObject({ status: "lobby", players: 2, names: ["Ali Valiyev", "Mehmon Bola"], item: null });
    expect(await state(room.room_id, OTHER, null)).toEqual({ ok: false, reason: "not_joined" });
    expect(await answer(room.room_id, P1, null, items[0], true)).toEqual({ ok: false, reason: "closed" }); // hali boshlanmagan

    await one(`select public.live_next($1, $2) as r`, [HOST, room.room_id]);
    const q = await state(room.room_id, P1, null);
    expect(q).toMatchObject({ status: "question", pos: 0, total: 2, answer: null, item: expect.objectContaining({ id: items[0], stem: "Savol 1" }) });
    expect(JSON.stringify(q.item)).not.toContain("index");

    expect(await answer(room.room_id, P1, null, items[1], true)).toEqual({ ok: false, reason: "closed" }); // joriy savol emas
    expect(await answer(room.room_id, P1, null, items[0], true)).toEqual({ ok: true });
    expect(await answer(room.room_id, P1, null, items[0], true)).toEqual({ ok: false, reason: "duplicate" });
    expect(await answer(room.room_id, null, "g1", items[0], false)).toEqual({ ok: true });
    const me = (await state(room.room_id, P1, null)).me as { score: number; rank: number; answered: boolean };
    expect(me.score).toBeGreaterThan(900);
    expect(me.rank).toBe(1);
    expect(me.answered).toBe(true);

    // host muddatidan oldin yopadi → javob kaliti va top chiqadi, yangi javob qabul qilinmaydi
    expect(await one(`select public.live_control($1, $2, 'reveal') as r`, [OTHER, room.room_id])).toBe(false);
    expect(await one(`select public.live_control($1, $2, 'reveal') as r`, [HOST, room.room_id])).toBe(true);
    const rv = await state(room.room_id, null, "g1");
    expect(rv).toMatchObject({ status: "reveal", answer: { index: 0 }, me: expect.objectContaining({ rank: 2, last: { correct: false, points: 0 } }) });
    expect((rv.top as { name: string }[]).map((t) => t.name)).toEqual(["Ali Valiyev", "Mehmon Bola"]);
    expect((await state(room.room_id, HOST, null, true)).distribution).toEqual({ "0": 2 });

    await one(`select public.live_next($1, $2) as r`, [HOST, room.room_id]);
    expect(await one(`select public.live_next($1, $2) as r`, [HOST, room.room_id])).toEqual({ ok: true, status: "finished" });
    const fin = await state(room.room_id, P1, null);
    expect(fin).toMatchObject({ status: "finished", item: null });
    expect(await join(room.pin, OTHER, null, "Kechikkan")).toEqual({ ok: false, reason: "not_found" });
  });

  it("vaqt tugasa — avtomatik reveal, javob qabul qilinmaydi", async () => {
    const room = await create();
    await join(room.pin, P1, null, "Ali");
    await one(`select public.live_next($1, $2) as r`, [HOST, room.room_id]);
    await db.query(`update live_rooms set question_ends_at = now() - interval '5 seconds' where id = $1`, [room.room_id]);
    expect((await state(room.room_id, P1, null)).status).toBe("reveal");
    expect(await answer(room.room_id, P1, null, items[0], true)).toEqual({ ok: false, reason: "closed" });
  });

  it("yangi xona ochilsa eski xona yopiladi; klient to'g'ridan-to'g'ri chaqira olmaydi", async () => {
    const a = await create();
    await create();
    const st = (await db.query<{ status: string }>(`select status from live_rooms where id = $1`, [a.room_id])).rows[0].status;
    expect(st).toBe("finished");
    await expect(asUser(db, P1, () => db.query(`select public.live_state($1, $2, null, false)`, [a.room_id, P1]))).rejects.toThrow(/permission denied/);
  });
});
