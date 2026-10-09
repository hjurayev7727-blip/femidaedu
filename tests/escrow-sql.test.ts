// Escrow: buyurtma, komissiya (kamida 20%), Payme orqali to'lov (obunasiz), karta + chek, topshirish, tasdiqlash,
// 3 kunlik avtomatik o'tkazish, nizo, qaytarish va clawback, payout, kontaktlar, sharh va reyting.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-0000000a0001";
const L = "00000000-0000-0000-0000-0000000a0002";
const C = "00000000-0000-0000-0000-0000000a0003";
const X = "00000000-0000-0000-0000-0000000a0004";
type J = Record<string, unknown>;
const one = async <T = J>(sql: string, params: unknown[] = []) => (await db.query<{ r: T }>(sql, params)).rows[0]?.r;
const rpc = (method: string, params: J) => one<{ result?: J; error?: { code: number } }>(`select public.payme_rpc($1, $2::jsonb) as r`, [method, JSON.stringify(params)]);
const status = async (id: unknown) => (await db.query<{ status: string }>(`select status from service_orders where id = $1`, [id])).rows[0].status;
let conv = "";
let txn = 0;

async function newOrder(price = 300000) {
  const o = await one<{ id: number }>(`select public.make_offer($1, $2, $3, 'Da''vo arizasi tayyorlash') as r`, [L, conv, price]);
  const s = await one<{ ok: boolean; id: number }>(`select public.create_service_order($1, $2) as r`, [C, o?.id]);
  return s!.id;
}
async function payByPayme(orderId: number) {
  const p = await one<{ code: string; amount_uzs: number }>(`select public.create_service_payme_order($1, $2) as r`, [C, orderId]);
  const id = `tx${++txn}`;
  const params = { id, time: Date.now(), amount: p!.amount_uzs * 100, account: { order_id: p!.code } };
  expect((await rpc("CheckPerformTransaction", params))?.result).toMatchObject({ allow: true, detail: { receipt_type: 0, items: [{ code: "10899001001000000", vat_percent: 0 }] } });
  expect((await rpc("CreateTransaction", params))?.result).toMatchObject({ state: 1 });
  expect((await rpc("PerformTransaction", { id }))?.result).toMatchObject({ state: 2 });
  return id;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1,'a@x.uz'),($2,'l@x.uz'),($3,'c@x.uz'),($4,'x@x.uz')`, [ADMIN, L, C, X]);
  await db.query(`update profiles set role = 'admin' where id = $1`, [ADMIN]);
  await db.query(`select public.upsert_lawyer_profile($1, '{"display_name":"Aziz Karimov","fields":["mehnat"],"phone":"+998901234567","telegram":"aziz_yurist","payout_card":"8600123412341234"}'::jsonb)`, [L]);
  conv = (await one<{ id: string }>(`select public.open_conversation($1, $2, null) as r`, [C, L]))!.id;
});

describe("escrow", () => {
  it("komissiya kamida 20%: sozlama 10 bo'lsa ham 20", async () => {
    await db.query(`update app_settings set value = '10' where key = 'lawyer_commission_pct'`);
    const id = await newOrder(300000);
    const r = (await db.query<J>(`select commission_pct, commission_uzs, payout_uzs from service_orders where id = $1`, [id])).rows[0];
    expect(r).toEqual({ commission_pct: 20, commission_uzs: 60000, payout_uzs: 240000 });
    await db.query(`update app_settings set value = '25' where key = 'lawyer_commission_pct'`);
    expect(await one(`select public.cancel_service_order($1, $2) as r`, [C, id])).toBe(true);
    expect(await status(id)).toBe("cancelled");
  });

  it("faqat taklif egasi buyurtma qiladi; takror chaqiruv o'sha buyurtma", async () => {
    const o = await one<{ id: number }>(`select public.make_offer($1, $2, 100000, 'Maslahat berish') as r`, [L, conv]);
    expect(await one(`select public.create_service_order($1, $2) as r`, [X, o?.id])).toEqual({ ok: false, reason: "not_found" });
    const a = await one<{ id: number }>(`select public.create_service_order($1, $2) as r`, [C, o?.id]);
    expect((await one<{ id: number }>(`select public.create_service_order($1, $2) as r`, [C, o?.id]))?.id).toBe(a?.id);
    const row = (await db.query<J>(`select commission_pct, commission_uzs, payout_uzs from service_orders where id = $1`, [a?.id])).rows[0];
    expect(row).toEqual({ commission_pct: 25, commission_uzs: 25000, payout_uzs: 75000 });
    await one(`select public.cancel_service_order($1, $2) as r`, [C, a?.id]);
  });

  it("Payme: to'lov → held, obuna va payments yozilmaydi; kontaktlar va chat ochiladi", async () => {
    expect(await one(`select public.conversation_paid($1) as r`, [conv])).toBe(false);
    expect(await one(`select public.lawyer_contacts($1, $2) as r`, [C, L])).toBeNull();
    const id = await newOrder(200000);
    const subs = Number((await db.query<{ n: number }>(`select count(*)::int as n from subscriptions`)).rows[0].n);
    const pays = Number((await db.query<{ n: number }>(`select count(*)::int as n from payments`)).rows[0].n);
    await payByPayme(id);
    expect(await status(id)).toBe("held");
    expect(Number((await db.query<{ n: number }>(`select count(*)::int as n from subscriptions`)).rows[0].n)).toBe(subs);
    expect(Number((await db.query<{ n: number }>(`select count(*)::int as n from payments`)).rows[0].n)).toBe(pays);
    expect(await one(`select public.conversation_paid($1) as r`, [conv])).toBe(true);
    expect(await one(`select public.lawyer_contacts($1, $2) as r`, [C, L])).toEqual({ phone: "+998901234567", telegram: "aziz_yurist" });
    expect(await one(`select public.lawyer_contacts($1, $2) as r`, [X, L])).toBeNull();
    // to'langan buyurtmani qayta to'lab bo'lmaydi
    expect(await one(`select public.create_service_payme_order($1, $2) as r`, [C, id])).toEqual({ ok: false, reason: "status" });
    // tasdiqlash → released; sharh bir marta, reyting yangilanadi
    expect(await one(`select public.leave_review($1, $2, 5, 'Zo''r') as r`, [C, id])).toEqual({ ok: false, reason: "status" });
    expect(await one(`select public.confirm_order($1, $2) as r`, [X, id])).toBe(false);
    expect(await one(`select public.confirm_order($1, $2) as r`, [C, id])).toBe(true);
    expect(await one(`select public.leave_review($1, $2, 4, 'Yaxshi') as r`, [C, id])).toEqual({ ok: true });
    expect(await one(`select public.leave_review($1, $2, 5, 'Yana') as r`, [C, id])).toEqual({ ok: false, reason: "already" });
    const lp = (await db.query<J>(`select rating_sum, rating_count from lawyer_profiles where user_id = $1`, [L])).rows[0];
    expect(lp).toEqual({ rating_sum: 4, rating_count: 1 });
    expect(await one(`select public.hide_review($1, $2, true) as r`, [ADMIN, id])).toBe(true);
    expect((await db.query<J>(`select rating_count from lawyer_profiles where user_id = $1`, [L])).rows[0].rating_count).toBe(0);
  });

  it("topshirish → 3 kun → avtomatik released; muddatdan keyin nizo yo'q", async () => {
    const id = await newOrder(150000);
    await payByPayme(id);
    expect(await one(`select public.mark_delivered($1, $2) as r`, [X, id])).toBe(false);
    expect(await one(`select public.mark_delivered($1, $2) as r`, [L, id])).toBe(true);
    expect(await one(`select public.release_due_orders() as r`)).toBe(0);
    await db.query(`update service_orders set release_after = now() - interval '1 minute' where id = $1`, [id]);
    expect(await one(`select public.open_dispute($1, $2, 'Ish sifatsiz bajarildi') as r`, [C, id])).toEqual({ ok: false, reason: "status" });
    expect(await one(`select public.release_due_orders() as r`)).toBe(1);
    expect(await status(id)).toBe("released");
  });

  it("nizo: to'xtatadi; admin qaytaradi yoki o'tkazadi", async () => {
    const a = await newOrder(120000);
    await payByPayme(a);
    expect(await one(`select public.open_dispute($1, $2, 'Yurist javob bermayapti') as r`, [C, a])).toEqual({ ok: true });
    expect(await status(a)).toBe("disputed");
    expect(await one(`select public.confirm_order($1, $2) as r`, [C, a])).toBe(false);
    expect(await one(`select public.resolve_dispute($1, $2, 'refund', 'Xizmat ko''rsatilmagan') as r`, [C, a])).toEqual({ ok: false, reason: "forbidden" });
    expect(await one(`select public.resolve_dispute($1, $2, 'refund', 'Xizmat ko''rsatilmagan') as r`, [ADMIN, a])).toMatchObject({ ok: true, provider: "payme" });
    expect(await status(a)).toBe("refunded");
  });

  it("Payme bekor qilish: held → refunded; released → clawback (payout'ga kirmaydi)", async () => {
    const a = await newOrder(110000);
    const ta = await payByPayme(a);
    expect((await rpc("CancelTransaction", { id: ta, reason: 5 }))?.result).toMatchObject({ state: -2 });
    expect(await status(a)).toBe("refunded");

    const b = await newOrder(130000);
    const tb = await payByPayme(b);
    await one(`select public.confirm_order($1, $2) as r`, [C, b]);
    await rpc("CancelTransaction", { id: tb, reason: 5 });
    const row = (await db.query<J>(`select status, clawback from service_orders where id = $1`, [b])).rows[0];
    expect(row).toEqual({ status: "released", clawback: true });
    const adm = await one<{ clawback: J[]; payouts: { order_ids: number[] }[] }>(`select public.escrow_admin($1) as r`, [ADMIN]);
    expect(adm?.clawback.map((o) => o.id)).toContain(b);
    expect(adm?.payouts[0].order_ids).not.toContain(b);
    expect(await one(`select public.record_payout($1, $2, $3, 'Bank 123') as r`, [ADMIN, L, [b]])).toEqual({ ok: false, reason: "orders" });
  });

  it("karta + chek: admin tasdiqlaydi; takroriy chek rad etiladi; rad etilsa qayta to'lash mumkin", async () => {
    const a = await newOrder(90000);
    expect(await one(`select public.submit_service_receipt($1, $2, $3, 'sha1') as r`, [C, a, `${X}/r.jpg`])).toEqual({ ok: false, reason: "path" });
    expect(await one(`select public.submit_service_receipt($1, $2, $3, 'sha1') as r`, [C, a, `${C}/r.jpg`])).toEqual({ ok: true });
    expect(await status(a)).toBe("review");
    expect(await one(`select public.review_service_receipt($1, $2, false, 'Summa mos emas') as r`, [ADMIN, a])).toMatchObject({ ok: true });
    expect(await status(a)).toBe("awaiting_payment");
    expect(await one(`select public.submit_service_receipt($1, $2, $3, 'sha2') as r`, [C, a, `${C}/r2.jpg`])).toEqual({ ok: true });
    const b = await newOrder(95000);
    expect(await one(`select public.submit_service_receipt($1, $2, $3, 'sha2') as r`, [C, b, `${C}/r3.jpg`])).toEqual({ ok: false, reason: "duplicate_receipt" });
    expect(await one(`select public.review_service_receipt($1, $2, true, null) as r`, [C, a])).toEqual({ ok: false, reason: "forbidden" });
    expect(await one(`select public.review_service_receipt($1, $2, true, null) as r`, [ADMIN, a])).toMatchObject({ ok: true });
    expect(await status(a)).toBe("held");
  });

  it("payout: faqat released, shu yurist; summa payout_uzs yig'indisi; paid_out", async () => {
    const adm = await one<{ payouts: { lawyer_id: string; total_uzs: number; order_ids: number[]; card: string }[] }>(`select public.escrow_admin($1) as r`, [ADMIN]);
    const p = adm!.payouts.find((x) => x.lawyer_id === L)!;
    expect(p.card).toBe("8600123412341234");
    expect(await one(`select public.record_payout($1, $2, $3, 'Bank 1') as r`, [C, L, p.order_ids])).toEqual({ ok: false, reason: "forbidden" });
    const r = await one<{ ok: boolean; amount_uzs: number }>(`select public.record_payout($1, $2, $3, 'Bank o''tkazma 77') as r`, [ADMIN, L, p.order_ids]);
    expect(r).toMatchObject({ ok: true, amount_uzs: Number(p.total_uzs) });
    for (const id of p.order_ids) expect(await status(id)).toBe("paid_out");
    expect(await one(`select public.escrow_admin($1) as r`, [C])).toBeNull();
  });

  it("Premium buyurtmasi o'zgarmagan; klient funksiyalarni chaqira olmaydi", async () => {
    const p = await one<{ ok: boolean; code: string }>(`select public.create_payme_order($1, 'oy1') as r`, [X]);
    expect(p?.code).toMatch(/^F[A-Z0-9]{9}$/);
    expect((await db.query<J>(`select kind, plan_code from payme_orders where code = $1`, [p?.code])).rows[0]).toEqual({ kind: "premium", plan_code: "oy1" });
    await expect(asUser(db, C, () => db.query(`select public.confirm_order($1, 1)`, [C]))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, C, () => db.query(`select * from service_orders`))).rejects.toThrow(/permission denied/);
  });
});
