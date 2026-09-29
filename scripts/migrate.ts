// Supabase bazasiga migratsiyalarni qo'llash:  npm run db:migrate [-- --seed]
// DATABASE_URL — Supabase → Connect → Session pooler satri (.env.local).
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { migrate, readMigrations, type Executor } from "./migrate-core";

try {
  process.loadEnvFile(".env.local");
} catch {
  // o'zgaruvchilar muhitdan olinadi
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL topilmadi (.env.local).");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

const executor: Executor = {
  query: async <T>(q: string, params: unknown[] = []) => (await sql.unsafe(q, params as never[])) as unknown as T[],
  execInTransaction: async (body, after, afterParams) => {
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx.unsafe(after, afterParams as never[]);
    });
  },
};

async function main() {
  const r = await migrate(executor, readMigrations("supabase/migrations"), console.log);
  console.log(`✓ Qo'llandi: ${r.applied.length} · avval qo'llangan: ${r.skipped.length}`);
  if (process.argv.includes("--seed")) {
    await sql.unsafe(readFileSync("supabase/seed.sql", "utf8"));
    console.log("✓ seed.sql (qayta ishga tushirish xavfsiz)");
  }
}

main()
  .catch((e: Error) => {
    console.error("✗", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
