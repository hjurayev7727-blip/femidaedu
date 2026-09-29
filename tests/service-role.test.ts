// Jonli ishga tushirishda topilgan xato: "Automatically expose new tables" o'chiq bo'lganda
// service_role public jadvallarga ruxsat olmagan edi ("permission denied for table profiles").
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./helpers/db";

let db: PGlite;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("service_role ruxsatlari", () => {
  it("public sxemadagi har bir jadvalda to'liq ruxsat bor", async () => {
    const { rows } = await db.query<{ t: string }>(
      `select c.oid::regclass::text as t from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p')
         and not has_table_privilege('service_role', c.oid, 'SELECT, INSERT, UPDATE, DELETE')`,
    );
    expect(rows.map((r) => r.t)).toEqual([]);
  });

  it("server roli profiles jadvalini o'qiy va yoza oladi", async () => {
    const U = "00000000-0000-0000-0000-00000000ab01";
    await db.query(`insert into auth.users (id, email) values ($1, 'sr@x.uz')`, [U]);
    await db.exec(`set role service_role`);
    try {
      await db.query(`update public.profiles set full_name = 'Server' where id = $1`, [U]);
      const r = await db.query<{ full_name: string }>(`select full_name from public.profiles where id = $1`, [U]);
      expect(r.rows[0]?.full_name).toBe("Server");
    } finally {
      await db.exec(`reset role`);
    }
  });

  it("keyin qo'shiladigan jadvallar ham avtomatik ochiladi", async () => {
    await db.exec(`create table public.zz_later (id int)`);
    const r = await db.query<{ ok: boolean }>(`select has_table_privilege('service_role', 'public.zz_later', 'SELECT, INSERT') as ok`);
    expect(r.rows[0].ok).toBe(true);
  });
});
