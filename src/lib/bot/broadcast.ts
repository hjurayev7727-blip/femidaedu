// Ko'p foydalanuvchiga xabar yuborish: Telegram chegarasi (~30 xabar/s) dan past tezlikda,
// bloklaganlarni belgilab, 429 da kutib qayta urinadi.
import { BotApiError, type BotApi, type SendOptions } from "@/lib/bot/api";

export type Recipient = { telegram_id: number };
export type BroadcastResult = { sent: number; blocked: number[]; failed: number };

const PER_SECOND = 25;

export async function broadcast<R extends Recipient>(
  api: BotApi,
  recipients: R[],
  build: (r: R) => { html: string; opts?: SendOptions },
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((res) => setTimeout(res, ms)),
): Promise<BroadcastResult> {
  const out: BroadcastResult = { sent: 0, blocked: [], failed: 0 };
  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const { html, opts } = build(r);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await api.sendMessage(r.telegram_id, html, opts);
        out.sent++;
        break;
      } catch (e) {
        if (e instanceof BotApiError && e.retryAfter && attempt === 0) {
          await sleep(e.retryAfter * 1000);
          continue;
        }
        if (e instanceof BotApiError && e.isBlocked) out.blocked.push(r.telegram_id);
        else out.failed++;
        break;
      }
    }
    if ((i + 1) % PER_SECOND === 0) await sleep(1000);
  }
  return out;
}
