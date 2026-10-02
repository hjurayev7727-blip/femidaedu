// Arizalar va yozishma: yo'naltirish, limitlar, ishtirokchilar, takliflar, o'qilganlik, bildirishnoma cheklovi, ruxsatlar.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-0000000f0001";
const L1 = "00000000-0000-0000-0000-0000000f0002"; // mehnat, tasdiqlangan
const L2 = "00000000-0000-0000-0000-0000000f0003"; // oila
const C = "00000000-0000-0000-0000-0000000f0004";
const X = "00000000-0000-0000-0000-0000000f0005";
type J = Record<string, unknown>;
const one = async <T = J>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0]?.r;
const req = (u: string, p: J) => one<J>(`select public.create_legal_request($1, $2::jsonb) as r`, [u, JSON.stringify({ title: "Ish haqi berilmayapti", body: "Ish beruvchi ikki oydan beri ish haqini bermayapti, nima qilay?", ...p })]);

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1,'a@x.uz'),($2,'l1@x.uz'),($3,'l2@x.uz'),($4,'c@x.uz'),($5,'x@x.uz')`, [ADMIN, L1, L2, C, X]);
  await db.query(`update profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`select public.upsert_lawyer_profile($1, '{"display_name":"Aziz Karimov","fields":["mehnat"]}'::jsonb)`, [L1]);
  await db.query(`select public.upsert_lawyer_profile($1, '{"display_name":"Dilnoza Rahimova","fields":["oila"]}'::jsonb)`, [L2]);
  await db.query(`update lawyer_profiles set verified_at = now() where user_id = $1`, [L1]);
});

describe("arizalar", () => {
  it("soha bo'yicha yo'naltiriladi; mos yurist yo'q — admin navbatiga", async () => {
    const a = await req(C, { field: "mehnat" });
    expect(a).toMatchObject({ ok: true, recipients: 1 });
    const inbox = await one<J[]>(`select public.request_inbox($1) as r`, [L1]);
    expect(inbox).toHaveLength(1);
    expect(inbox?.[0]).toMatchObject({ new: true, direct: false });
    expect((await one<J[]>(`select public.request_inbox($1) as r`, [L1]))?.[0]).toMatchObject({ new: false });
    expect(await one<J[]>(`select public.request_inbox($1) as r`, [L2])).toEqual([]);

    const b = await req(C, { field: "soliq" });
    expect(b).toMatchObject({ ok: true, recipients: 0 });
    const un = await one<J[]>(`select public.unrouted_requests($1) as r`, [ADMIN]);
    expect(un?.map((u) => u.id)).toEqual([b?.id]);
    expect(await one(`select public.unrouted_requests($1) as r`, [C])).toBeNull();
    expect(await one(`select public.assign_request($1, $2, $3) as r`, [ADMIN, b?.id, L2])).toBe(true);
    expect(await one<J[]>(`select public.unrouted_requests($1) as r`, [ADMIN])).toEqual([]);
  });

  it("3 ta ochiq ariza chegarasi; noto'g'ri soha va o'ziga ariza rad etiladi", async () => {
    expect(await req(C, { field: "yoq" })).toEqual({ ok: false, reason: "field" });
    expect(await req(L1, { target_lawyer: L1 })).toEqual({ ok: false, reason: "lawyer" });
    expect(await req(C, { target_lawyer: L2 })).toMatchObject({ ok: true, recipients: 1 });
    expect(await req(C, {})).toEqual({ ok: false, reason: "open_limit" });
  });

  it("AI xabari faqat o'z suhbatidan olinadi", async () => {
    const t = await db.query<{ id: string }>(`insert into tutor_threads (user_id, mode, title) values ($1, 'legal', 'S') returning id`, [X]);
    const m = await db.query<{ id: number }>(`insert into tutor_messages (thread_id, role, content) values ($1, 'assistant', 'AI javobi (MK 1-modda)') returning id`, [t.rows[0].id]);
    const r1 = await req(X, { tutor_message_id: m.rows[0].id, field: "mehnat" });
    const row = await db.query<{ source: string; ai_snapshot: string }>(`select source, ai_snapshot from legal_requests where id = $1`, [r1?.id]);
    expect(row.rows[0]).toEqual({ source: "ai", ai_snapshot: "AI javobi (MK 1-modda)" });
    const mine = (await one<J[]>(`select public.my_requests($1) as r`, [C])) ?? [];
    const r2 = await one<J>(`select public.close_request($1, $2) as r`, [C, mine[0].id]);
    expect(r2).toBe(true);
    // C boshqa birovning AI xabaridan foydalana olmaydi
    const r3 = await req(C, { tutor_message_id: m.rows[0].id });
    const row3 = await db.query<{ source: string }>(`select source from legal_requests where id = $1`, [r3?.id]);
    expect(row3.rows[0].source).toBe("form");
  });
});

describe("yozishma", () => {
  let conv = "";
  it("yurist arizaga javob beradi; begona ochib bo'lmaydi; takror ochilmaydi", async () => {
    const reqId = (await db.query<{ id: number }>(`select id from legal_requests where client_id = $1 and field = 'mehnat'`, [C])).rows[0].id;
    expect(await one(`select public.open_conversation($1, $2, $3) as r`, [L2, C, reqId])).toEqual({ ok: false, reason: "request" });
    const o = await one<{ ok: boolean; id: string }>(`select public.open_conversation($1, $2, $3) as r`, [L1, C, reqId]);
    expect(o?.ok).toBe(true);
    conv = o!.id;
    expect((await one<{ id: string }>(`select public.open_conversation($1, $2, $3) as r`, [L1, C, reqId]))?.id).toBe(conv);
    // mijoz to'g'ridan-to'g'ri (ariza siz) — alohida suhbat
    const d = await one<{ id: string }>(`select public.open_conversation($1, $2, null) as r`, [C, L1]);
    expect(d?.id).not.toBe(conv);
    expect(await one(`select public.open_conversation($1, $2, null) as r`, [C, C])).toEqual({ ok: false, reason: "lawyer" });
  });

  it("xabarlar, o'qilganlik, bildirishnoma 10 daqiqada 1 ta, tezlik chegarasi", async () => {
    const s1 = await one<J>(`select public.send_message($1, $2, 'Salom, hujjatlarni yuboraymi?') as r`, [C, conv]);
    expect(s1).toMatchObject({ ok: true, notify: L1 });
    const s2 = await one<J>(`select public.send_message($1, $2, 'Yana bir savol') as r`, [C, conv]);
    expect(s2).toMatchObject({ ok: true, notify: null });
    expect(await one(`select public.send_message($1, $2, 'men begona') as r`, [X, conv])).toEqual({ ok: false, reason: "not_found" });

    const list = await one<J[]>(`select public.my_conversations($1) as r`, [L1]);
    expect(list?.find((c) => c.id === conv)).toMatchObject({ unread: 2, role: "lawyer" });
    const poll = await one<J & { messages: J[] }>(`select public.chat_poll($1, $2, 0) as r`, [L1, conv]);
    expect(poll).toMatchObject({ ok: true, role: "lawyer", paid: false });
    expect(poll?.messages.map((m) => m.kind)).toEqual(["system", "text", "text"]);
    expect((await one<J[]>(`select public.my_conversations($1) as r`, [L1]))?.find((c) => c.id === conv)).toMatchObject({ unread: 0 });
    const after = await one<{ messages: J[]; other_read: number }>(`select public.chat_poll($1, $2, $3) as r`, [C, conv, poll?.messages.at(-1)?.id]);
    expect(after?.messages).toEqual([]);
    expect(after?.other_read).toBe(poll?.messages.at(-1)?.id);
    expect(await one(`select public.chat_poll($1, $2, 0) as r`, [X, conv])).toEqual({ ok: false, reason: "not_found" });

    for (let i = 0; i < 18; i++) await one(`select public.send_message($1, $2, $3) as r`, [C, conv, `m${i}`]);
    expect(await one(`select public.send_message($1, $2, 'ortiqcha') as r`, [C, conv])).toEqual({ ok: false, reason: "rate" });
  });

  it("taklif: faqat suhbat yuristi; yangisi eskisini almashtiradi; mijoz rad etadi", async () => {
    expect(await one(`select public.make_offer($1, $2, 500000, 'Da''vo arizasi tayyorlash') as r`, [L2, conv])).toEqual({ ok: false, reason: "not_found" });
    const o1 = await one<J>(`select public.make_offer($1, $2, 500000, 'Da''vo arizasi tayyorlash') as r`, [L1, conv]);
    const o2 = await one<J>(`select public.make_offer($1, $2, 400000, 'Da''vo arizasi, chegirma bilan') as r`, [L1, conv]);
    const offers = (await one<{ offers: J[] }>(`select public.chat_poll($1, $2, 0) as r`, [C, conv]))?.offers ?? [];
    expect(offers.map((o) => [o.id, o.status])).toEqual([[o1?.id, "withdrawn"], [o2?.id, "pending"]]);
    expect(await one(`select public.decline_offer($1, $2) as r`, [L1, o2?.id])).toBe(false);
    expect(await one(`select public.decline_offer($1, $2) as r`, [C, o2?.id])).toBe(true);
  });

  it("bloklangan yurist yoza olmaydi; klient to'g'ridan-to'g'ri kira olmaydi", async () => {
    await db.query(`update lawyer_profiles set status = 'blocked' where user_id = $1`, [L1]);
    expect(await one(`select public.send_message($1, $2, 'salom') as r`, [L1, conv])).toEqual({ ok: false, reason: "blocked" });
    await expect(asUser(db, C, () => db.query(`select * from messages`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, C, () => db.query(`select public.chat_poll($1, $2, 0)`, [C, conv]))).rejects.toThrow(/permission denied/);
  });
});
