// Bot sozlamalari: webhook (maxfiy token bilan), buyruqlar menyusi va Mini App tugmasi.
// scripts/bot-setup.ts (qo'lda) va src/instrumentation.ts / kunlik cron (avtomatik) ishlatadi.
import type { BotApi } from "@/lib/bot/api";

// chat_join_request — hamjamiyat guruhiga qo'shilish so'rovlari (bot u yerda admin)
export const BOT_UPDATES = ["message", "my_chat_member", "callback_query", "chat_join_request"];

type WebhookInfo = { url?: string; last_error_date?: number; last_error_message?: string; allowed_updates?: string[] };

/** Webhook, buyruqlar, menyu tugmasi va tavsifni o'rnatadi. */
export async function setupBot(api: BotApi, site: string, secret: string, opts: { dropPending?: boolean } = {}) {
  await api.call("setWebhook", {
    url: webhookUrl(site),
    secret_token: secret,
    allowed_updates: BOT_UPDATES,
    drop_pending_updates: opts.dropPending ?? false,
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
    menu_button: { type: "web_app", text: "Femida Edu", web_app: { url: `${site}/tg` } },
  });
  await api.call("setMyDescription", {
    description: "Huquq fanidan milliy sertifikatga tayyorgarlik: 3 000+ savol, sinov imtihoni, izoh va qonun moddalari. Start bosing!",
  });
}

export function webhookUrl(site: string) {
  return `${site.replace(/\/$/, "")}/api/bot`;
}

/**
 * Webhook boshqa manzilga qarasa, umuman o'rnatilmagan bo'lsa yoki Telegram 403 olayotgan bo'lsa (secret mos emas) —
 * qayta o'rnatadi. Hammasi joyida bo'lsa Telegram'ga bitta so'rov (getWebhookInfo) bilan cheklanadi.
 */
export async function ensureBotWebhook(
  api: BotApi,
  site: string,
  secret: string,
  now = Date.now(),
): Promise<"ok" | "updated"> {
  const info = await api.call<WebhookInfo>("getWebhookInfo", {});
  // Eski xato emas, so'nggi soatdagi 403 — secret haqiqatan mos kelmayapti
  const recent403 =
    (info.last_error_date ?? 0) * 1000 > now - 3_600_000 && /\b403\b|forbidden/i.test(info.last_error_message ?? "");
  const healthy =
    info.url === webhookUrl(site) &&
    !recent403 &&
    BOT_UPDATES.every((u) => info.allowed_updates?.includes(u));
  if (healthy) return "ok";
  await setupBot(api, site, secret);
  return "updated";
}
