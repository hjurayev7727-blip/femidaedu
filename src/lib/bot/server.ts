import "server-only";
import { createBotApi, esc, type BotApi } from "@/lib/bot/api";
import { openApp, type BotDeps, type BotStats } from "@/lib/bot/handler";
import { botEnv, env } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/server";

let cached: { token: string; api: BotApi } | null = null;

export function botApi(): BotApi | null {
  const cfg = botEnv();
  if (!cfg) return null;
  if (cached?.token !== cfg.TELEGRAM_BOT_TOKEN) cached = { token: cfg.TELEGRAM_BOT_TOKEN, api: createBotApi(cfg.TELEGRAM_BOT_TOKEN) };
  return cached.api;
}

export function botDeps(api: BotApi): BotDeps {
  const admin = createSupabaseAdmin();
  return {
    api,
    siteUrl: env().NEXT_PUBLIC_SITE_URL,
    async stats(telegramId) {
      const { data, error } = await admin.rpc("bot_user_stats", { p_telegram: telegramId });
      if (error) throw new Error(`bot_user_stats: ${error.message}`);
      return data as BotStats;
    },
    async setBotEnabled(telegramId, enabled) {
      const { data } = await admin.from("profiles").update({ bot_enabled: enabled }).eq("telegram_id", telegramId).select("id");
      return (data?.length ?? 0) > 0;
    },
  };
}

/** Foydalanuvchiga bot orqali xabar (bot yoqilmagan bo'lsa jim o'tadi). Hech qachon xato tashlamaydi. */
export async function notifyUser(userId: string, html: string, button?: { text: string; path: string }): Promise<void> {
  try {
    const api = botApi();
    if (!api) return;
    const { data: p } = await createSupabaseAdmin()
      .from("profiles")
      .select("telegram_id, bot_enabled")
      .eq("id", userId)
      .maybeSingle<{ telegram_id: number | null; bot_enabled: boolean }>();
    if (!p?.telegram_id || !p.bot_enabled) return;
    await api.sendMessage(
      Number(p.telegram_id),
      html,
      button ? { reply_markup: { inline_keyboard: openApp(env().NEXT_PUBLIC_SITE_URL, button.text, button.path) } } : undefined,
    );
  } catch (e) {
    console.error("notifyUser", (e as Error).message);
  }
}

export function mockResultMessage(r: { grade: string | null; scaled: number; raw: number; correct: number; total: number }) {
  return [
    `⏱ <b>Sinov imtihoni yakunlandi</b>`,
    ``,
    `Daraja: <b>${esc(r.grade ?? "—")}</b> · ${r.scaled} / 75`,
    `Birlamchi ball: ${r.raw} / 100 · ${r.correct}/${r.total} to'g'ri`,
    r.grade ? `` : `Sertifikat darajasi (C) uchun 46 ball kerak — xatolar ustida ishlang 💪`,
  ]
    .filter((l, i, a) => !(l === "" && i === a.length - 1))
    .join("\n");
}
