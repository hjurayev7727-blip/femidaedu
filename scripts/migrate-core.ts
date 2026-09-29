// Migratsiyalarni ketma-ket qo'llash mantiqi (bazaga bog'liq emas — testda PGlite, haqiqatda postgres).
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Executor = {
  /** bitta so'rov, natija qatorlari */
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** bir nechta buyruqli SQL faylni tranzaksiyada bajaradi */
  execInTransaction(sql: string, after: string, afterParams: unknown[]): Promise<void>;
};

export type MigrationFile = { name: string; sql: string; checksum: string };

export function readMigrations(dir: string): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort()
    .map((name) => {
      const sql = readFileSync(join(dir, name), "utf8");
      return { name, sql, checksum: createHash("sha256").update(sql).digest("hex").slice(0, 16) };
    });
}

const LEDGER = `
create schema if not exists private;
revoke all on schema private from public;
create table if not exists private.app_migrations (
  name text primary key,
  checksum text not null,
  applied_at timestamptz not null default now()
);`;

export type MigrateResult = { applied: string[]; skipped: string[] };

/**
 * Qo'llanmagan migratsiyalarni tartib bilan bajaradi. Allaqachon qo'llangan fayl o'zgartirilgan bo'lsa —
 * to'xtaydi (migratsiyani tahrirlash o'rniga yangisini yozish kerak).
 */
export async function migrate(db: Executor, files: MigrationFile[], log: (s: string) => void = () => {}): Promise<MigrateResult> {
  for (const stmt of LEDGER.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
  const rows = await db.query<{ name: string; checksum: string }>(`select name, checksum from private.app_migrations`);
  const done = new Map(rows.map((r) => [r.name, r.checksum]));

  const result: MigrateResult = { applied: [], skipped: [] };
  for (const f of files) {
    const prev = done.get(f.name);
    if (prev) {
      if (prev !== f.checksum) {
        throw new Error(`${f.name} qo'llanganidan keyin o'zgartirilgan (checksum ${prev} → ${f.checksum}). Yangi migratsiya fayli yarating.`);
      }
      result.skipped.push(f.name);
      continue;
    }
    log(`→ ${f.name}`);
    await db.execInTransaction(f.sql, `insert into private.app_migrations (name, checksum) values ($1, $2)`, [f.name, f.checksum]);
    result.applied.push(f.name);
  }
  return result;
}
