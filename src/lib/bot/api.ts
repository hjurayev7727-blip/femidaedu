// Telegram Bot API — minimal klient (qo'shimcha kutubxonasiz). https://core.telegram.org/bots/api

export class BotApiError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    readonly description: string,
    readonly retryAfter?: number,
  ) {
    super(`${method}: ${code} ${description}`);
  }
  /** Foydalanuvchi botni bloklagan / chat yo'q — unga boshqa yozmaslik kerak */
  get isBlocked() {
    return this.code === 403 || (this.code === 400 && /chat not found|user is deactivated/i.test(this.description));
  }
}

export type InlineButton = { text: string; url?: string; web_app?: { url: string }; callback_data?: string };
export type SendOptions = { reply_markup?: { inline_keyboard: InlineButton[][] }; disable_notification?: boolean };

export type BotApi = {
  call<T = unknown>(method: string, params: Record<string, unknown>): Promise<T>;
  sendMessage(chatId: number, html: string, opts?: SendOptions): Promise<void>;
};

export function createBotApi(token: string, fetchImpl: typeof fetch = fetch): BotApi {
  async function call<T>(method: string, params: Record<string, unknown>): Promise<T> {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
    });
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      result?: T;
      error_code?: number;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (!body.ok) throw new BotApiError(method, body.error_code ?? res.status, body.description ?? "unknown", body.parameters?.retry_after);
    return body.result as T;
  }
  return {
    call,
    async sendMessage(chatId, html, opts = {}) {
      await call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true }, ...opts });
    },
  };
}

/** Telegram HTML rejimi uchun maxsus belgilarni qochirish */
export function esc(s: string | number | null | undefined): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
