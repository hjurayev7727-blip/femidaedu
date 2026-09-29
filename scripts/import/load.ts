// data/v1/bundle.json ni Supabase bazasiga yuklaydi:  npm run db:import
// DATABASE_URL — Supabase → Connect → "Session pooler" satri (parol bilan). Faqat .env.local da saqlang.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import type { Bundle } from "./bundle";
import { bundleToSql } from "./sql";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local yo'q — o'zgaruvchi muhitdan olinadi
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL topilmadi (.env.local). README → '5. Savollarni yuklash' ga qarang.");
  process.exit(1);
}

const bundle = JSON.parse(readFileSync("data/v1/bundle.json", "utf8")) as Bundle;
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

async function main() {
  const stmts = bundleToSql(bundle);
  await sql.begin(async (tx) => {
    for (const [i, s] of stmts.entries()) {
      await tx.unsafe(s);
      process.stdout.write(`\r${i + 1}/${stmts.length}`);
    }
  });
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from public.questions`;
  console.log(`\n✓ Tayyor: bazada ${n} ta savol (to'plamda ${bundle.questions.length}).`);
}

main()
  .catch((e: Error) => {
    console.error("\n✗ Import to'xtadi, hech narsa o'zgarmadi (tranzaksiya bekor qilindi):", e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
