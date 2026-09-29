import { describe, expect, it, vi } from "vitest";
import { BotApiError, createBotApi, esc, type BotApi } from "@/lib/bot/api";
import { broadcast } from "@/lib/bot/broadcast";
import { appUrl, handleUpdate, statsText, type BotDeps, type BotStats } from "@/lib/bot/handler";

const SITE = "https://aplus.test";

function fakeApi() {
  const sent: { chat: number; html: string; opts?: unknown }[] = [];
  const api: BotApi = {
    call: vi.fn(),
    sendMessage: vi.fn(async (chat: number, html: string, opts?: unknown) => void sent.push({ chat, html, opts })),
  };
  return { api, sent };
}

function deps(over: Partial<BotDeps> = {}) {
  const { api, sent } = fakeApi();
  const enabled = new Map<number, boolean>();
  const d: BotDeps = {
    api,
    siteUrl: SITE,
    stats: async () => ({ found: false }),
    setBotEnabled: async (id, on) => (enabled.set(id, on), id === 42),
    ...over,
  };
  return { d, sent, enabled };
}

const msg = (text: string, from = 42, type = "private") => ({
  update_id: 1,
  message: { message_id: 1, from: { id: from, first_name: "Ali <b>" }, chat: { id: from, type }, text },
});

describe("handleUpdate", () => {
  it("/start — bog'langan foydalanuvchi: bot yoqiladi, platforma tugmasi", async () => {
    const { d, sent, enabled } = deps();
    await handleUpdate(msg("/start"), d);
    expect(enabled.get(42)).toBe(true);
    expect(sent[0].html).toContain("Hisobingiz bog'landi");
    expect(sent[0].html).toContain("Ali &lt;b&gt;"); // ism qochirilgan (HTML in'ektsiya yo'q)
    expect(JSON.stringify(sent[0].opts)).toContain(appUrl(SITE));
  });

  it("/start — yangi foydalanuvchi: kirish taklifi", async () => {
    const { d, sent } = deps();
    await handleUpdate(msg("/start", 7), d);
    expect(sent[0].html).toContain("Boshlash uchun");
  });

  it("/kunlik — Mini App orqali kunlik testga", async () => {
    const { d, sent } = deps();
    await handleUpdate(msg("/kunlik@aplus_bot"), d);
    expect(JSON.stringify(sent[0].opts)).toContain(encodeURIComponent("/api/kunlik"));
  });

  it("/natija — statistika yoki kirish taklifi", async () => {
    const stats: BotStats = { found: true, name: "Ali", streak: 5, best: 9, today: 7, due: 3, answered: 120, last_mock: { grade: "B+", scaled: 61.2, at: "" } };
    const a = deps({ stats: async () => stats });
    await handleUpdate(msg("/natija"), a.d);
    expect(a.sent[0].html).toContain("5 kun");
    expect(a.sent[0].html).toContain("yana 3 ta");
    expect(a.sent[0].html).toContain("B+");
    const b = deps();
    await handleUpdate(msg("/natija"), b.d);
    expect(b.sent[0].html).toContain("topilmadi");
  });

  it("guruh xabarlari, botlar va matnsiz xabarlar e'tiborsiz qoldiriladi", async () => {
    const { d, sent } = deps();
    await handleUpdate(msg("/start", 42, "group"), d);
    await handleUpdate({ update_id: 2, message: { message_id: 1, from: { id: 1, is_bot: true }, chat: { id: 1, type: "private" }, text: "/start" } }, d);
    await handleUpdate({ update_id: 3, message: { message_id: 1, from: { id: 1 }, chat: { id: 1, type: "private" } } }, d);
    expect(sent).toHaveLength(0);
  });

  it("noma'lum matn — yordam", async () => {
    const { d, sent } = deps();
    await handleUpdate(msg("salom"), d);
    expect(sent[0].html).toContain("/kunlik");
  });

  it("botni bloklash / qayta ochish — bot_enabled yangilanadi", async () => {
    const { d, enabled } = deps();
    const upd = (status: string) => ({
      update_id: 5,
      my_chat_member: { chat: { id: 42, type: "private" }, from: { id: 42 }, new_chat_member: { status } },
    });
    await handleUpdate(upd("kicked"), d);
    expect(enabled.get(42)).toBe(false);
    await handleUpdate(upd("member"), d);
    expect(enabled.get(42)).toBe(true);
  });
});

describe("statsText", () => {
  it("10 va undan ko'p savol — ✓", () => {
    expect(statsText({ found: true, name: "", streak: 1, best: 1, today: 10, due: 0, answered: 10, last_mock: null })).toContain("10</b> ta savol ✓");
  });
});

describe("createBotApi", () => {
  it("xatoda BotApiError (kod, retry_after)", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 3 } })));
    const api = createBotApi("T", f as unknown as typeof fetch);
    await expect(api.sendMessage(1, "x")).rejects.toMatchObject({ code: 429, retryAfter: 3 });
    expect((f.mock.calls[0] as unknown[])[0]).toBe("https://api.telegram.org/botT/sendMessage");
  });
  it("403 — bloklangan", () => {
    expect(new BotApiError("sendMessage", 403, "Forbidden: bot was blocked by the user").isBlocked).toBe(true);
    expect(new BotApiError("sendMessage", 400, "Bad Request: chat not found").isBlocked).toBe(true);
    expect(new BotApiError("sendMessage", 500, "x").isBlocked).toBe(false);
  });
  it("esc", () => expect(esc("<a & b>")).toBe("&lt;a &amp; b&gt;"));
});

describe("broadcast", () => {
  it("yuboradi, bloklaganlarni ajratadi, 429 da kutib qayta urinadi, sekundiga ≤25", async () => {
    let first429 = true;
    const api: BotApi = {
      call: vi.fn(),
      sendMessage: vi.fn(async (chat: number) => {
        if (chat === 2) throw new BotApiError("sendMessage", 403, "Forbidden: bot was blocked by the user");
        if (chat === 3 && first429) {
          first429 = false;
          throw new BotApiError("sendMessage", 429, "Too Many Requests", 2);
        }
        if (chat === 4) throw new BotApiError("sendMessage", 500, "oops");
      }),
    };
    const sleeps: number[] = [];
    const recipients = Array.from({ length: 30 }, (_, i) => ({ telegram_id: i + 1 }));
    const r = await broadcast(api, recipients, () => ({ html: "x" }), async (ms) => void sleeps.push(ms));
    expect(r).toEqual({ sent: 28, blocked: [2], failed: 1 }); // 30 - bloklangan - xato
    expect(sleeps).toEqual([2000, 1000]); // 429 kutish + 25-xabardan keyin 1 s
  });
});
