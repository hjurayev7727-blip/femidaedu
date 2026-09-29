// Testlar uchun PGlite: Supabase'ning auth sxemasi va rollari minimal "stub" bilan, keyin barcha migratsiyalar.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Bundle } from "../../scripts/import/bundle";
import { bundleToSql } from "../../scripts/import/sql";

const root = join(__dirname, "..", "..");

export async function createTestDb(opts: { seed?: boolean; bundle?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    grant usage on schema auth to anon, authenticated;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public to anon, authenticated;
  `);
  for (const f of readdirSync(join(root, "supabase/migrations")).sort()) {
    await db.exec(readFileSync(join(root, "supabase/migrations", f), "utf8"));
  }
  if (opts.seed ?? true) await db.exec(readFileSync(join(root, "supabase/seed.sql"), "utf8"));
  if (opts.bundle) for (const stmt of bundleToSql(loadBundle())) await db.exec(stmt);
  return db;
}

let cached: Bundle | null = null;
export function loadBundle(): Bundle {
  cached ??= JSON.parse(readFileSync(join(root, "data/v1/bundle.json"), "utf8")) as Bundle;
  return cached;
}

/** Berilgan foydalanuvchi nomidan (authenticated + RLS) bajaradi */
export async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}
