import { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { migrate, readMigrations, type Executor, type MigrationFile } from "../scripts/migrate-core";

async function freshDb() {
  const db = new PGlite();
  // Supabase muhitini taqlid qiluvchi minimal stub (auth sxemasi va rollar)
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
    grant usage on schema public to anon, authenticated;
  `);
  const ex: Executor = {
    query: async <T>(sql: string, params: unknown[] = []) => (await db.query<T>(sql, params)).rows,
    execInTransaction: async (body, after, afterParams) => {
      await db.transaction(async (tx) => {
        await tx.exec(body);
        await tx.query(after, afterParams);
      });
    },
  };
  return { db, ex };
}

const files = readMigrations(join(__dirname, "..", "supabase/migrations"));

describe("db:migrate", () => {
  it("barcha migratsiyalar tartib bilan qo'llanadi, qayta ishga tushirish hech narsa qilmaydi", async () => {
    const { ex } = await freshDb();
    const first = await migrate(ex, files);
    expect(first.applied).toEqual(files.map((f) => f.name));
    expect(first.applied.length).toBeGreaterThanOrEqual(8);
    const second = await migrate(ex, files);
    expect(second).toEqual({ applied: [], skipped: files.map((f) => f.name) });
  });

  it("faqat yangi migratsiya qo'llanadi", async () => {
    const { ex, db } = await freshDb();
    await migrate(ex, files.slice(0, 3));
    const r = await migrate(ex, files);
    expect(r.applied).toEqual(files.slice(3).map((f) => f.name));
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from private.app_migrations`);
    expect(rows[0].n).toBe(files.length);
  });

  it("qo'llangan fayl o'zgartirilsa — to'xtaydi", async () => {
    const { ex } = await freshDb();
    await migrate(ex, files.slice(0, 1));
    const edited: MigrationFile[] = [{ ...files[0], checksum: "boshqa" }];
    await expect(migrate(ex, edited)).rejects.toThrow(/o'zgartirilgan/);
  });

  it("xato migratsiya bekor qilinadi va qo'llangan deb belgilanmaydi", async () => {
    const { ex, db } = await freshDb();
    const bad: MigrationFile = { name: "99990101000000_xato.sql", sql: "create table public.yarim (id int); select nonexistent_fn();", checksum: "x" };
    await expect(migrate(ex, [bad])).rejects.toThrow();
    const t = await db.query<{ n: number }>(`select count(*)::int as n from information_schema.tables where table_name = 'yarim'`);
    expect(t.rows[0].n).toBe(0);
    const m = await db.query<{ n: number }>(`select count(*)::int as n from private.app_migrations`);
    expect(m.rows[0].n).toBe(0);
  });

  it("private sxemasi mijoz rollariga yopiq", async () => {
    const { ex, db } = await freshDb();
    await migrate(ex, files.slice(0, 1));
    await db.exec(`set role authenticated`);
    await expect(db.query(`select * from private.app_migrations`)).rejects.toThrow(/permission denied/);
    await db.exec(`reset role`);
  });
});
