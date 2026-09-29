// Premium: qo'lda to'lov → admin tasdiqlashi → obuna.
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDb } from "./helpers/db";

let db: PGlite;
const ADMIN = "00000000-0000-0000-0000-00000000ad01";
const one = async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows[0];
let n = 0;
const newUser = async () => {
  const id = `00000000-0000-0000-0000-0000000001${String(++n).padStart(2, "0")}`;
  await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `p${n}@x.uz`]);
  return id;
};
type R = { ok: boolean; reason?: string; id?: number; already?: boolean };
let receipt = 0;
const pay = async (u: string, plan = "oy1", sha = `sha-${++receipt}`) =>
  (await one<{ r: R }>(`select public.create_manual_payment($1, $2, $3, $4) as r`, [u, plan, `${u}/chek.jpg`, sha])).r;
const approve = async (admin: string, id: number) => (await one<{ r: R }>(`select public.approve_payment($1, $2) as r`, [admin, id])).r;
const premium = (u: string) => asUser(db, u, () => one<{ p: boolean }>(`select public.is_premium() as p`)).then((r) => r.p);
const until = (u: string) => asUser(db, u, () => one<{ t: string | null }>(`select public.my_premium_until() as t`)).then((r) => r.t);

beforeAll(async () => {
  db = await createTestDb();
  await db.query(`insert into auth.users (id, email) values ($1, 'admin@x.uz')`, [ADMIN]);
  await db.query(`update public.profiles set role = 'admin' where id = $1`, [ADMIN]);
});

describe("qo'lda to'lov", () => {
  it("to'lov yaratiladi, narx va muddat tarifdan olinadi; ikkinchi kutilayotgan to'lov rad etiladi", async () => {
    const u = await newUser();
    const r = await pay(u, "oy3");
    expect(r.ok).toBe(true);
    const p = await one<{ amount_uzs: number; months: number; status: string }>(`select amount_uzs, months, status from public.payments where id = $1`, [r.id]);
    expect(p).toEqual({ amount_uzs: 129000, months: 3, status: "pending" });
    expect(await pay(u)).toMatchObject({ ok: false, reason: "pending" });
    expect(await pay(await newUser(), "yoq")).toMatchObject({ ok: false, reason: "plan" });
  });

  it("faqat admin tasdiqlaydi; tasdiqdan keyin Premium yoqiladi, qayta tasdiq obunani ikkilamaydi", async () => {
    const u = await newUser();
    const { id } = await pay(u);
    expect(await approve(u, id!)).toMatchObject({ ok: false, reason: "forbidden" });
    expect(await premium(u)).toBe(false);

    expect(await approve(ADMIN, id!)).toMatchObject({ ok: true, already: false });
    expect(await premium(u)).toBe(true);
    expect(await approve(ADMIN, id!)).toMatchObject({ ok: true, already: true });
    const { c } = await one<{ c: number }>(`select count(*)::int as c from public.subscriptions where user_id = $1`, [u]);
    expect(c).toBe(1);
  });

  it("yangi to'lov obunani joriy muddat tugagan kundan uzaytiradi", async () => {
    const u = await newUser();
    await approve(ADMIN, (await pay(u, "oy1")).id!);
    const first = Date.parse((await until(u))!);
    await approve(ADMIN, (await pay(u, "oy3")).id!);
    const second = Date.parse((await until(u))!);
    const days = (second - first) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(89);
    expect(days).toBeLessThanOrEqual(92);
  });

  it("rad etish: sabab saqlanadi, Premium yoqilmaydi, rad etilganini tasdiqlab bo'lmaydi", async () => {
    const u = await newUser();
    const { id } = await pay(u);
    const r = await one<{ r: R }>(`select public.reject_payment($1, $2, 'Chek o''qilmaydi') as r`, [ADMIN, id]);
    expect(r.r.ok).toBe(true);
    expect(await premium(u)).toBe(false);
    expect(await approve(ADMIN, id!)).toMatchObject({ ok: false, reason: "status" });
    expect((await pay(u)).ok).toBe(true); // rad etilgandan keyin qayta yuborish mumkin
  });

  it("mijoz to'lov yarata olmaydi, obuna qo'sha olmaydi va server funksiyalarini chaqira olmaydi", async () => {
    const u = await newUser();
    await expect(
      asUser(db, u, () => db.query(`insert into public.payments (user_id, provider, amount_uzs, status) values ('${u}', 'manual', 1, 'paid')`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, u, () => db.query(`insert into public.subscriptions (user_id, ends_at) values ('${u}', now() + interval '1 year')`)),
    ).rejects.toThrow(/permission denied/);
    for (const sql of [
      `select public.create_manual_payment('${u}', 'oy1', 'x', 'y')`,
      `select public.approve_payment('${u}', 1)`,
      `select public.reject_payment('${u}', 1, 'x')`,
    ]) {
      await expect(asUser(db, u, () => db.query(sql))).rejects.toThrow(/permission denied/);
    }
  });

  it("bir xil chek (sha256) ikkinchi marta qabul qilinmaydi; rad etilgan chekni qayta yuborish mumkin", async () => {
    const a = await newUser();
    const b = await newUser();
    expect((await pay(a, "oy1", "bir-xil")).ok).toBe(true);
    expect(await pay(b, "oy1", "bir-xil")).toMatchObject({ ok: false, reason: "duplicate_receipt" });
    const { id } = await one<{ id: number }>(`select id from public.payments where receipt_sha256 = 'bir-xil'`);
    await db.query(`select public.reject_payment($1, $2, 'soxta')`, [ADMIN, id]);
    expect((await pay(b, "oy1", "bir-xil")).ok).toBe(true);
  });

  it("tariflar va to'lov rekvizitlari o'qiladi, boshqa sozlamalar yopiq", async () => {
    const u = await newUser();
    await db.query(`insert into public.app_settings (key, value) values ('maxfiy', '{"x":1}')`);
    const rows = await asUser(db, u, () => db.query<{ key: string }>(`select key from public.app_settings`).then((r) => r.rows));
    expect(rows.map((r) => r.key)).toEqual(["manual_payment"]);
    const plans = await asUser(db, u, () => db.query(`select code from public.plans order by sort`).then((r) => r.rows));
    expect(plans).toEqual([{ code: "oy1" }, { code: "oy3" }]);
  });
});
