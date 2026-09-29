// Botni sozlash: webhook (maxfiy token bilan), buyruqlar menyusi va Mini App tugmasi.
//   npm run bot:setup            — .env.local dagi NEXT_PUBLIC_SITE_URL ga ulaydi
//   npm run bot:setup -- info    — joriy webhook holati
import { createBotApi } from "../src/lib/bot/api";

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

  await api.call("setWebhook", {
    url: `${site}/api/bot`,
    secret_token: secret,
    allowed_updates: ["message", "my_chat_member", "callback_query"],
    drop_pending_updates: true,
  });
  await api.call("setMyCommands", {
    commands: [
      { command: "kunlik", description: "Bugungi 10 ta savol" },
      { command: "natija", description: "Streak va natijalarim" },
      { command: "sozlamalar", description: "Eslatmalar" },
      { command: "yordam", description: "Buyruqlar ro'yxati" },
    ],
  });
  await api.call("setChatMenuButton", {
    menu_button: { type: "web_app", text: "A+ Huquq", web_app: { url: `${site}/tg` } },
  });
  await api.call("setMyDescription", {
    description: "Huquq fanidan milliy sertifikatga tayyorgarlik: 3 000+ savol, sinov imtihoni, izoh va qonun moddalari. Start bosing!",
  });
  console.log(`✓ Webhook: ${site}/api/bot · buyruqlar va menyu tugmasi o'rnatildi`);
}

main().catch((e: Error) => {
  console.error("✗", e.message);
  process.exitCode = 1;
});
