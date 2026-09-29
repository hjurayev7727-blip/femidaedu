import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/** Imzolangan ma'lumot necha soniyagacha amal qiladi (takroriy ishlatishdan himoya) */
const MAX_AGE_SEC = 24 * 60 * 60;

const WIDGET_FIELDS = new Set(["id", "first_name", "last_name", "username", "photo_url", "auth_date", "hash"]);

function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

function dataCheckString(params: Map<string, string>): string {
  return [...params.entries()]
    .filter(([k]) => k !== "hash")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
}

function checkAge(authDate: string | undefined, now: number): boolean {
  const t = Number(authDate);
  return Number.isFinite(t) && t > 0 && now - t <= MAX_AGE_SEC && t - now <= 60;
}

/**
 * Telegram Login Widget imzosini tekshiradi.
 * https://core.telegram.org/widgets/login#checking-authorization
 * kalit = SHA256(bot_token), hash = HMAC_SHA256(data_check_string, kalit)
 */
export function verifyLoginWidget(
  query: URLSearchParams | Record<string, string>,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): TelegramUser | null {
  // Widget o'z maydonlarini bizning auth URL'imizga qo'shadi; URL'dagi boshqa parametrlar
  // (masalan ?keyin=) imzoga kirmaydi — shuning uchun faqat Telegram maydonlari olinadi.
  const source = query instanceof URLSearchParams ? [...query.entries()] : Object.entries(query);
  const params = new Map(source.filter(([k]) => WIDGET_FIELDS.has(k)));
  const hash = params.get("hash");
  if (!hash || !botToken) return null;

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString(params)).digest("hex");
  if (!safeEqualHex(hash, expected) || !checkAge(params.get("auth_date"), now)) return null;

  const id = Number(params.get("id"));
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  return {
    id,
    first_name: params.get("first_name") ?? "",
    last_name: params.get("last_name") || undefined,
    username: params.get("username") || undefined,
    photo_url: params.get("photo_url") || undefined,
  };
}

/**
 * Telegram Mini App (WebApp) initData imzosini tekshiradi.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * kalit = HMAC_SHA256(bot_token, "WebAppData"), hash = HMAC_SHA256(data_check_string, kalit)
 */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
  now = Math.floor(Date.now() / 1000),
): TelegramUser | null {
  // hash dan boshqa barcha maydonlar (jumladan "signature") tekshiruv satriga kiradi
  const params = new Map(new URLSearchParams(initData).entries());
  const hash = params.get("hash");
  if (!hash || !botToken) return null;

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString(params)).digest("hex");
  if (!safeEqualHex(hash, expected) || !checkAge(params.get("auth_date"), now)) return null;

  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    return Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

export function displayName(u: TelegramUser): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || (u.username ? `@${u.username}` : `Telegram ${u.id}`);
}
