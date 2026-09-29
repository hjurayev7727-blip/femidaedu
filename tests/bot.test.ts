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
    loginRequest: async () => null,
    confirmLogin: async () => false,
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

describe("saytga bot orqali kirish", () => {
  const TOKEN = "abcdefghijklmnopqrstuvwxyz012345"; // 32 belgi
  const REQ = "11111111-2222-3333-4444-555555555555";

  it("/start login_<kod>: kutilayotgan so'rov bo'lsa — ogohlantirish va Tasdiqlash/Bekor tugmalari", async () => {
    const seen: string[] = [];
    const { d, sent } = deps({ loginRequest: async (h) => (seen.push(h), { id: REQ }) });
    await handleUpdate(msg(`/start login_${TOKEN}`), d);
    expect(seen[0]).toMatch(/^[a-f0-9]{64}$/); // bazaga kod emas, xesh
    expect(seen[0]).not.toContain(TOKEN);
    expect(sent[0].html).toContain("tasdiqlamang");
    const kb = (sent[0].opts as { reply_markup: { inline_keyboard: { callback_data: string }[][] } }).reply_markup.inline_keyboard;
    expect(kb.flat().map((b) => b.callback_data)).toEqual([`lg:${REQ}`, `lgx:${REQ}`]);
  });

  it("muddati o'tgan yoki buzuq kod — tushuntirish, tugmasiz", async () => {
    const { d, sent } = deps({ loginRequest: async () => null });
    await handleUpdate(msg(`/start login_${TOKEN}`), d);
    await handleUpdate(msg("/start login_qisqa"), d);
    expect(sent).toHaveLength(2);
    expect(sent.every((m) => m.html.includes("muddati o'tgan") && !m.opts)).toBe(true);
  });

  const cb = (data: string, from = { id: 42, first_name: "Ali", username: "ali" }) => ({
    update_id: 2,
    callback_query: { id: "q1", from, data, message: { message_id: 9, chat: { id: 42, type: "private" } } },
  });

  it("Tasdiqlash: callback egasi (Telegram tasdiqlagan) nomidan tasdiqlanadi va xabar yangilanadi", async () => {
    const confirmed: [string, unknown][] = [];
    const { d } = deps({ confirmLogin: async (id, tg) => (confirmed.push([id, tg]), true) });
    await handleUpdate(cb(`lg:${REQ}`), d);
    expect(confirmed).toEqual([[REQ, { id: 42, first_name: "Ali", last_name: undefined, username: "ali" }]]);
    const calls = (d.api.call as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(calls).toEqual(["answerCallbackQuery", "editMessageText"]);
  });

  it("eskirgan tasdiq, bekor qilish va begona callback — tasdiqlanmaydi", async () => {
    const confirmed: string[] = [];
    const { d } = deps({ confirmLogin: async (id) => (confirmed.push(id), false) });
    await handleUpdate(cb(`lg:${REQ}`), d); // eskirgan
    await handleUpdate(cb(`lgx:${REQ}`), d); // bekor
    await handleUpdate(cb("lg:not-a-uuid"), d);
    await handleUpdate(cb("boshqa"), d);
    expect(confirmed).toEqual([REQ]); // faqat birinchisi urinib ko'rildi (va rad etildi)
  });
});
