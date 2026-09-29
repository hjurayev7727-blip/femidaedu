// Payme Merchant API mantig'i (payme_rpc) — Payme sandbox ssenariylari bo'yicha.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
type Rpc = { result?: Record<string, unknown>; error?: { code: number; message: string; data?: string } };

const rpc = async (method: string, params: Record<string, unknown>) =>
  (await db.query<{ r: Rpc }>(`select public.payme_rpc($1, $2::jsonb) as r`, [method, JSON.stringify(params)])).rows[0].r;
const order = async (uid: string, plan = "oy1") =>
  (await db.query<{ r: { ok: boolean; code: string; amount_uzs: number; reason?: string } }>(`select public.create_payme_order($1, $2) as r`, [uid, plan])).rows[0].r;
const premiumEnd = async (uid: string) =>
  (await db.query<{ e: Date | null }>(`select max(ends_at) as e from public.subscriptions where user_id = $1`, [uid])).rows[0].e;
let n = 0;
const newUser = async () => {
  const id = `00000000-0000-0000-0000-0000000d${String(++n).padStart(4, "0")}`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `p${n}@x.uz`]);
  return id;
};
const now = () => Date.now();

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("create_payme_order", () => {
  it("A + 9 belgili kod, tarif narxi; takroriy bosishda o'sha buyurtma qaytadi", async () => {
    const u = await newUser();
    const a = await order(u);
    expect(a).toMatchObject({ ok: true, amount_uzs: 49000 });
    expect(a.code).toMatch(/^A[A-Z0-9]{9}$/);
    expect((await order(u)).code).toBe(a.code);
    expect((await order(u, "oy3")).amount_uzs).toBe(129000);
    expect(await order(u, "yoq")).toMatchObject({ ok: false, reason: "plan" });
  });
});

describe("payme_rpc", () => {
  it("CheckPerformTransaction: topilmadi / noto'g'ri summa / ruxsat", async () => {
    const u = await newUser();
    const { code } = await order(u);
    expect((await rpc("CheckPerformTransaction", { amount: 4900000, account: { order_id: "AZZZZZZZZZ" } })).error).toMatchObject({ code: -31050, data: "order_id" });
    expect((await rpc("CheckPerformTransaction", { amount: 100, account: { order_id: code } })).error?.code).toBe(-31001);
    expect((await rpc("CheckPerformTransaction", { amount: 4900000, account: { order_id: code } })).result).toEqual({ allow: true });
  });

  it("to'liq yo'l: Create → (qayta Create) → Perform → Premium; ikkinchi tranzaksiya rad etiladi", async () => {
    const u = await newUser();
    const { code } = await order(u);
    const t = now();
    const c1 = await rpc("CreateTransaction", { id: "tx-1", time: t, amount: 4900000, account: { order_id: code } });
    expect(c1.result).toMatchObject({ transaction: "tx-1", state: 1 });
    // Payme bir xil so'rovni qayta yuborsa — o'sha natija
    expect((await rpc("CreateTransaction", { id: "tx-1", time: t, amount: 4900000, account: { order_id: code } })).result).toMatchObject({ transaction: "tx-1", state: 1, create_time: c1.result!.create_time });
    // Shu buyurtmaga boshqa tranzaksiya — mumkin emas
    expect((await rpc("CreateTransaction", { id: "tx-2", time: t, amount: 4900000, account: { order_id: code } })).error).toMatchObject({ code: -31050 });

    expect(await premiumEnd(u)).toBeNull();
    const p = await rpc("PerformTransaction", { id: "tx-1" });
    expect(p.result).toMatchObject({ transaction: "tx-1", state: 2 });
    const end = await premiumEnd(u);
    expect(end).not.toBeNull();
    expect(new Date(end!).getTime() - Date.now()).toBeGreaterThan(27 * 86400e3);
    // Qayta Perform — o'sha natija, ikkinchi marta Premium qo'shilmaydi
    expect((await rpc("PerformTransaction", { id: "tx-1" })).result).toMatchObject({ state: 2, perform_time: p.result!.perform_time });
    expect(await premiumEnd(u)).toEqual(end);
    const pays = await db.query<{ provider: string; status: string; external_id: string }>(`select provider, status, external_id from public.payments where user_id = $1`, [u]);
    expect(pays.rows).toEqual([{ provider: "payme", status: "paid", external_id: "tx-1" }]);
    // To'langan buyurtmani qayta to'lab bo'lmaydi
    expect((await rpc("CheckPerformTransaction", { amount: 4900000, account: { order_id: code } })).error?.code).toBe(-31051);
    // Yangi to'lov uchun yangi buyurtma beriladi
    expect((await order(u)).code).not.toBe(code);
  });

  it("CancelTransaction: to'lanmagan → -1; to'langan → -2, Premium muddati qaytariladi, keyingi obuna suriladi", async () => {
    const u = await newUser();
    const a = await order(u);
    await rpc("CreateTransaction", { id: "tx-c1", time: now(), amount: 4900000, account: { order_id: a.code } });
    expect((await rpc("CancelTransaction", { id: "tx-c1", reason: 3 })).result).toMatchObject({ state: -1 });
    expect((await rpc("CancelTransaction", { id: "tx-c1", reason: 3 })).result).toMatchObject({ state: -1 }); // takror — o'sha
    expect((await rpc("PerformTransaction", { id: "tx-c1" })).error?.code).toBe(-31008);
    expect((await rpc("CheckTransaction", { id: "tx-c1" })).result).toMatchObject({ state: -1, reason: 3 });

    // Ikki oylik to'lov ketma-ket: 1-sini qaytarsak, 2-si oldinga suriladi
    const b = await order(u);
    await rpc("CreateTransaction", { id: "tx-b", time: now(), amount: 4900000, account: { order_id: b.code } });
    await rpc("PerformTransaction", { id: "tx-b" });
    const c = await order(u);
    await rpc("CreateTransaction", { id: "tx-c", time: now(), amount: 4900000, account: { order_id: c.code } });
    await rpc("PerformTransaction", { id: "tx-c" });
    const twoMonths = new Date((await premiumEnd(u))!).getTime();

    expect((await rpc("CancelTransaction", { id: "tx-b", reason: 5 })).result).toMatchObject({ state: -2 });
    const after = new Date((await premiumEnd(u))!).getTime();
    expect(twoMonths - after).toBeGreaterThan(27 * 86400e3); // bir oy olib tashlandi
    expect(after - Date.now()).toBeGreaterThan(27 * 86400e3); // ikkinchi oy qoldi
    const st = await db.query<{ status: string }>(`select status from public.payments where external_id = 'tx-b'`);
    expect(st.rows[0].status).toBe("refunded");
  });

  it("12 soatdan eski tranzaksiya — Timeout (-31008), buyurtma bekor", async () => {
    const u = await newUser();
    const { code } = await order(u);
    await rpc("CreateTransaction", { id: "tx-old", time: now() - 13 * 3600e3, amount: 4900000, account: { order_id: code } });
    expect((await rpc("PerformTransaction", { id: "tx-old" })).error).toMatchObject({ code: -31008 });
    expect((await rpc("CheckTransaction", { id: "tx-old" })).result).toMatchObject({ state: -1, reason: 4 });
    expect(await premiumEnd(u)).toBeNull();
  });

  it("topilmagan tranzaksiya, GetStatement, noma'lum metod", async () => {
    expect((await rpc("PerformTransaction", { id: "yoq" })).error?.code).toBe(-31003);
    expect((await rpc("CancelTransaction", { id: "yoq", reason: 1 })).error?.code).toBe(-31003);
    expect((await rpc("CheckTransaction", { id: "yoq" })).error?.code).toBe(-31003);
    const s = await rpc("GetStatement", { from: now() - 3600e3, to: now() + 1000 });
    const txs = s.result!.transactions as { id: string; account: { order_id: string } }[];
    expect(txs.map((t) => t.id)).toContain("tx-1");
    expect(txs[0].account.order_id).toMatch(/^A/);
    expect((await rpc("GetStatement", { from: 0, to: 1 })).result).toEqual({ transactions: [] });
    expect((await rpc("ChangePassword", { password: "xxxxxxxx" })).error?.code).toBe(-32601);
  });

  it("mijoz Payme funksiyalarini chaqira olmaydi va jadvallarni ko'rmaydi", async () => {
    const u = await newUser();
    await expect(asUser(db, u, () => db.query(`select public.payme_rpc('CheckTransaction', '{}')`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, u, () => db.query(`select public.create_payme_order('${u}', 'oy1')`))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, u, () => db.query(`select * from public.payme_transactions`))).rejects.toThrow(/permission denied/);
  });
});
