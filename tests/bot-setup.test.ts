import { describe, expect, it, vi } from "vitest";
import type { BotApi } from "@/lib/bot/api";
import { BOT_UPDATES, ensureBotWebhook, webhookUrl } from "@/lib/bot/setup";

const SITE = "https://femidaedu.test";
const NOW = 1_800_000_000_000;

function fakeApi(info: Record<string, unknown>) {
  const call = vi.fn(async (method: string) => (method === "getWebhookInfo" ? info : true));
  const api = { call, sendMessage: vi.fn() } as unknown as BotApi;
  const methods = () => call.mock.calls.map((c) => c[0]);
  return { api, call, methods };
}

describe("ensureBotWebhook", () => {
  it("webhook joyida — faqat getWebhookInfo", async () => {
    const { api, methods } = fakeApi({ url: `${SITE}/api/bot`, allowed_updates: BOT_UPDATES });
    expect(await ensureBotWebhook(api, SITE, "s".repeat(32), NOW)).toBe("ok");
    expect(methods()).toEqual(["getWebhookInfo"]);
  });

  it("webhook bo'sh — o'rnatadi (secret bilan, eski xabarlarni o'chirmasdan)", async () => {
    const { api, call, methods } = fakeApi({ url: "" });
    expect(await ensureBotWebhook(api, SITE, "s".repeat(32), NOW)).toBe("updated");
    expect(methods()).toEqual(["getWebhookInfo", "setWebhook", "setMyCommands", "setChatMenuButton", "setMyDescription"]);
    expect(call).toHaveBeenCalledWith("setWebhook", {
      url: `${SITE}/api/bot`,
      secret_token: "s".repeat(32),
      allowed_updates: BOT_UPDATES,
      drop_pending_updates: false,
    });
  });

  it("so'nggi soatda 403 — secret mos emas, qayta o'rnatadi", async () => {
    const { api } = fakeApi({
      url: `${SITE}/api/bot`, allowed_updates: BOT_UPDATES,
      last_error_date: NOW / 1000 - 60, last_error_message: "Wrong response from the webhook: 403 Forbidden",
    });
    expect(await ensureBotWebhook(api, SITE, "s".repeat(32), NOW)).toBe("updated");
  });

  it("eski 403 xatosi qayta o'rnatishga sabab bo'lmaydi", async () => {
    const { api } = fakeApi({
      url: `${SITE}/api/bot`, allowed_updates: BOT_UPDATES,
      last_error_date: NOW / 1000 - 7200, last_error_message: "Wrong response from the webhook: 403 Forbidden",
    });
    expect(await ensureBotWebhook(api, SITE, "s".repeat(32), NOW)).toBe("ok");
  });

  it("boshqa manzil yoki yetishmayotgan update turi — qayta o'rnatadi", async () => {
    expect(await ensureBotWebhook(fakeApi({ url: "https://old.test/api/bot", allowed_updates: BOT_UPDATES }).api, SITE, "x".repeat(32), NOW)).toBe("updated");
    expect(await ensureBotWebhook(fakeApi({ url: `${SITE}/api/bot`, allowed_updates: ["message"] }).api, SITE, "x".repeat(32), NOW)).toBe("updated");
  });

  it("webhookUrl oxirgi / ni olib tashlaydi", () => {
    expect(webhookUrl(`${SITE}/`)).toBe(`${SITE}/api/bot`);
  });
});
