// Saytga bot orqali kirish (Telegram Login Widget'siz): bir martalik kod, bot tasdig'i, brauzerga bog'langan cookie.
import { createHash, randomBytes } from "node:crypto";
import type { TelegramUser } from "@/lib/telegram";

export const BOT_LOGIN_COOKIE = "tg_login";
export const BOT_LOGIN_PREFIX = "login_";
export const BOT_LOGIN_TTL_SEC = 600;

/** 32 belgili base64url — Telegram /start parametri ([A-Za-z0-9_-], ≤64) ga mos */
export const newLoginToken = () => randomBytes(24).toString("base64url");
export const hashLoginToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isLoginToken = (s: string) => /^[A-Za-z0-9_-]{32}$/.test(s);

export function botLoginLink(bot: string, token: string) {
  return `https://t.me/${bot}?start=${BOT_LOGIN_PREFIX}${token}`;
}

/** callback_query.from → signInTelegramUser kutgan shakl (bot orqali rasm havolasi kelmaydi) */
export function tgFromCallback(from: { id: number; first_name?: string; last_name?: string; username?: string }): TelegramUser {
  return { id: from.id, first_name: from.first_name ?? "", last_name: from.last_name, username: from.username };
}
