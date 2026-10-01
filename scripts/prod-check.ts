// Production'dan oldin tekshiruv: kalitlar bor va to'g'rimi, xizmatlar javob beradimi (hech narsani o'zgartirmaydi).
//   npm run prod:check
import Anthropic from "@anthropic-ai/sdk";
import { readdirSync } from "node:fs";
import postgres from "postgres";
import { AI_MODEL } from "../src/lib/ai";

try {
  process.loadEnvFile(".env.local");
} catch {
  // o'zgaruvchilar muhitdan olinadi
}
const e = process.env;
type Row = { name: string; ok: boolean; note: string };
const rows: Row[] = [];
const check = async (name: string, fn: () => Promise<string> | string) => {
  try {
    rows.push({ name, ok: true, note: await fn() });
  } catch (err) {
    rows.push({ name, ok: false, note: (err as Error).message.slice(0, 160) });
  }
};
const need = (k: string, re?: RegExp) => {
  const v = e[k];
  if (!v) throw new Error(`${k} yo'q`);
  if (re && !re.test(v)) throw new Error(`${k} formati noto'g'ri`);
  return v;
};

async function main() {
  await check("Sayt manzili (HTTPS)", () => {
    const u = need("NEXT_PUBLIC_SITE_URL", /^https:\/\/[^/]+$/);
    return u;
  });
  await check("Supabase ochiq kalit", async () => {
    const url = need("NEXT_PUBLIC_SUPABASE_URL", /^https:\/\/[a-z0-9]+\.supabase\.co$/);
    const key = need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const r = await fetch(`${url}/rest/v1/fields?select=slug&limit=1`, { headers: { apikey: key } });
    if (r.status === 404 || r.status === 400) return "ulanish bor (fields jadvali hali yo'q — migratsiya kerak)";
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return "ulanish bor";
  });
  await check("Supabase maxfiy kalit", () => (need("SUPABASE_SECRET_KEY").startsWith("sb_publishable") ? Promise.reject(new Error("bu ochiq kalit, maxfiy emas")) : "bor"));
  await check("Baza (DATABASE_URL) va migratsiyalar", async () => {
    const sql = postgres(need("DATABASE_URL"), { max: 1, prepare: false, connect_timeout: 10, onnotice: () => {} });
    try {
      const files = readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).length;
      const [t] = await sql<{ exists: boolean }[]>`select to_regclass('private.app_migrations') is not null as exists`;
      if (!t.exists) return `ulanish bor · migratsiyalar hali qo'llanmagan (${files} ta)`;
      const [c] = await sql<{ n: number }[]>`select count(*)::int as n from private.app_migrations`;
      return `ulanish bor · migratsiyalar ${c.n}/${files}`;
    } finally {
      await sql.end();
    }
  });
  await check("Anthropic (AI testlar, AI ustoz)", async () => {
    const client = new Anthropic({ apiKey: need("ANTHROPIC_API_KEY") });
    const m = await client.models.retrieve(AI_MODEL);
    return `model ${m.id} mavjud`;
  });
  await check("Telegram bot", async () => {
    const token = need("TELEGRAM_BOT_TOKEN", /^\d+:[\w-]+$/);
    const r = (await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json()) as { ok: boolean; result?: { username: string } };
    if (!r.ok || !r.result) throw new Error("token yaroqsiz");
    const want = e.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
    if (want && want.toLowerCase() !== r.result.username.toLowerCase()) throw new Error(`@${r.result.username} ≠ NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (${want})`);
    return `@${r.result.username}`;
  });
  await check("Webhook va cron maxfiy qiymatlari", () => {
    need("TELEGRAM_WEBHOOK_SECRET", /^[A-Za-z0-9_-]{24,256}$/);
    need("CRON_SECRET", /^.{24,}$/);
    return "bor";
  });
  await check("Payme", () => {
    need("PAYME_MERCHANT_ID");
    need("PAYME_FORWARD_SECRET", /^.{32,}$/);
    return e.PAYME_CHECKOUT_URL?.includes("test") ? "sinov kassasi" : "bor";
  });

  for (const r of rows) console.log(`${r.ok ? "✓" : "✗"} ${r.name.padEnd(38)} ${r.note}`);
  const bad = rows.filter((r) => !r.ok).length;
  console.log(bad ? `\n${bad} ta muammo — docs/PRODUCTION.md` : "\nHammasi tayyor.");
  process.exit(bad ? 1 : 0);
}

void main();
