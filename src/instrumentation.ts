/**
 * Server ishga tushganda (faqat Vercel production): Telegram webhook'i shu saytga, Vercel'dagi secret bilan
 * ulanganini tekshiradi va kerak bo'lsa o'rnatadi — `npm run bot:setup` ni qo'lda ishlatish shart emas.
 * Kutilmaydi (await yo'q): server so'rovlarni darhol qabul qilaveradi.
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL_ENV !== "production") return;
  void (async () => {
    try {
      const [{ botEnv, env }, { createBotApi }, { ensureBotWebhook }] = await Promise.all([
        import("@/lib/env"),
        import("@/lib/bot/api"),
        import("@/lib/bot/setup"),
      ]);
      const cfg = botEnv();
      const site = env().NEXT_PUBLIC_SITE_URL;
      if (!cfg || !site.startsWith("https://")) return;
      const result = await ensureBotWebhook(createBotApi(cfg.TELEGRAM_BOT_TOKEN), site, cfg.TELEGRAM_WEBHOOK_SECRET);
      if (result === "updated") console.log(`bot: webhook o'rnatildi → ${site}/api/bot`);
    } catch (e) {
      console.error("bot: webhook'ni tekshirib bo'lmadi:", e instanceof Error ? e.message : e);
    }
  })();
}
