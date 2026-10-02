// Botni sozlash: webhook (maxfiy token bilan), buyruqlar menyusi va Mini App tugmasi.
//   npm run bot:setup            — .env.local dagi NEXT_PUBLIC_SITE_URL ga ulaydi
//   npm run bot:setup -- info    — joriy webhook holati
// Production'da buni qo'lda qilish shart emas: src/instrumentation.ts webhook'ni o'zi ulaydi.
import { createBotApi } from "../src/lib/bot/api";
import { setupBot } from "../src/lib/bot/setup";

try {
  process.loadEnvFile(".env.local");
} catch {
  // o'zgaruvchilar muhitdan olinadi
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const site = process.env.NEXT_PUBLIC_SITE_URL;

async function main() {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN yo'q (.env.local)");
  const api = createBotApi(token);

  if (process.argv[2] === "info") {
    console.log(await api.call("getWebhookInfo", {}));
    return;
  }
  if (!secret || secret.length < 24) throw new Error("TELEGRAM_WEBHOOK_SECRET kamida 24 belgi bo'lsin (openssl rand -hex 32)");
  if (!site?.startsWith("https://")) throw new Error("NEXT_PUBLIC_SITE_URL https:// bilan boshlanishi kerak (Telegram faqat HTTPS webhook qabul qiladi)");

  await setupBot(api, site, secret, { dropPending: true });
  console.log(`✓ Webhook: ${site}/api/bot · buyruqlar va menyu tugmasi o'rnatildi`);
}

main().catch((e: Error) => {
  console.error("✗", e.message);
  process.exitCode = 1;
});
