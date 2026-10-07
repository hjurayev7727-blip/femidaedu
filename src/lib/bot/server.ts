import "server-only";
import { createBotApi, esc, type BotApi } from "@/lib/bot/api";
import { communityAnswer } from "@/lib/ai";
import { aiClient, logUsage } from "@/lib/ai-server";
import { openApp, type BotDeps, type BotStats } from "@/lib/bot/handler";
import { BOT_USERNAME_DEFAULT, CHAT_DAILY_ANSWERS, hamjamiyatChatId, USER_DAILY_ANSWERS, type CommunityDeps } from "@/lib/bot/hamjamiyat";
import { botEnv, env } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { findSources } from "@/lib/tutor-server";
import { sourceRef } from "@/lib/tutor";

let cached: { token: string; api: BotApi } | null = null;

export function botApi(): BotApi | null {
  const cfg = botEnv();
  if (!cfg) return null;
  if (cached?.token !== cfg.TELEGRAM_BOT_TOKEN) cached = { token: cfg.TELEGRAM_BOT_TOKEN, api: createBotApi(cfg.TELEGRAM_BOT_TOKEN) };
  return cached.api;
}

export function botUsername(): string {
  return (env().NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? BOT_USERNAME_DEFAULT).replace(/^@/, "");
}

/** Hamjamiyat guruhi: profil tekshiruvi, kunlik limit (atomar, bazada) va AI javob (qonun bazasidagi moddalar bilan) */
export function communityDeps(): CommunityDeps {
  const admin = createSupabaseAdmin();
  const chatId = hamjamiyatChatId();
  return {
    chatId,
    botId: Number(botEnv()?.TELEGRAM_BOT_TOKEN.split(":")[0] ?? 0),
    username: botUsername(),
    async knownUser(telegramId) {
      const { data } = await admin.from("profiles").select("id").eq("telegram_id", telegramId).limit(1);
      return (data?.length ?? 0) > 0;
    },
    async consume(telegramId) {
      const { data, error } = await admin.rpc("consume_community_quota", {
        p_chat: chatId, p_user: telegramId, p_user_limit: USER_DAILY_ANSWERS, p_chat_limit: CHAT_DAILY_ANSWERS,
      });
      return !error && data === true;
    },
    async answer(question, context) {
      const c = aiClient();
      if (!c) return null;
      const sources = await findSources(question, null, { max: 4 }).catch(() => []);
      const r = await communityAnswer(c, {
        question, context, sources: sources.map((a) => ({ ref: sourceRef(a), title: a.title, body: a.body })),
      });
      if (!r.ok) return null;
      await logUsage(null, "community", r.usage).catch(() => {});
      return r.data.answer.trim() || null;
    },
  };
}

export function botDeps(api: BotApi): BotDeps {
  const admin = createSupabaseAdmin();
  return {
    api,
    community: communityDeps(),
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
    async loginRequest(tokenHash) {
      const { data } = await admin
        .from("bot_logins")
        .select("id")
        .eq("token_hash", tokenHash)
        .is("confirmed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle<{ id: string }>();
      return data ?? null;
    },
    async confirmLogin(id, tg) {
      const { data } = await admin
        .from("bot_logins")
        .update({ tg, confirmed_at: new Date().toISOString() })
        .eq("id", id)
        .is("confirmed_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("id");
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
