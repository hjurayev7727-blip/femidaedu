// Hamjamiyat guruhi: qo'shilish so'rovlari, @eslatma/javobga AI javob, oddiy xabarlarga tegmaslik, kunlik post.
import { describe, expect, it, vi } from "vitest";
import type { BotApi } from "@/lib/bot/api";
import { handleUpdate, type BotDeps, type Update } from "@/lib/bot/handler";
import {
  ANSWER_MAX, clipAnswer, fallbackTip, FALLBACK_TIPS, hamjamiyatChatId, HAMJAMIYAT_DEFAULT_ID, isAddressed, postDailyTip,
  tashkentClock, type CommunityDeps, type DailyPostDeps,
} from "@/lib/bot/hamjamiyat";

const CHAT = -1003651189754;
const BOT_ID = 777;

function setup(over: Partial<CommunityDeps> = {}) {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const sent: { chat: number; html: string }[] = [];
  const api: BotApi = {
    call: vi.fn(async (method: string, params: Record<string, unknown>) => {
      calls.push({ method, params });
      if (method === "approveChatJoinRequest" && params.user_id === 999) throw new Error("HIDE_REQUESTER_MISSING");
      return true;
    }) as BotApi["call"],
    sendMessage: vi.fn(async (chat: number, html: string) => void sent.push({ chat, html })),
  };
  const community: CommunityDeps = {
    chatId: CHAT,
    botId: BOT_ID,
    username: "femidaedu_bot",
    knownUser: vi.fn(async (id: number) => id === 42),
    consume: vi.fn(async () => true),
    answer: vi.fn(async () => "Mehnat shartnomasi yozma shaklda tuziladi <b>."),
    ...over,
  };
  const d: BotDeps = {
    api, siteUrl: "https://femida.test", community,
    stats: async () => ({ found: false }),
    setBotEnabled: async () => true,
    loginRequest: async () => null,
    confirmLogin: async () => false,
  };
  const methods = () => calls.map((c) => c.method);
  return { d, community, calls, sent, methods };
}

const groupMsg = (over: Record<string, unknown> = {}): Update => ({
  update_id: 1,
  message: { message_id: 10, from: { id: 42, first_name: "Ali" }, chat: { id: CHAT, type: "supergroup" }, text: "Salom hammaga", ...over },
});

describe("guruh xabarlari — xavfsizlik", () => {
  it("oddiy xabar: hech qanday javob, bazaga murojaat yo'q", async () => {
    const { d, community, methods, sent } = setup();
    await handleUpdate(groupMsg(), d);
    await handleUpdate(groupMsg({ text: "/start" }), d);
    await handleUpdate(groupMsg({ text: "/yordam@femidaedu_bot" }), d);
    expect(methods()).toEqual([]);
    expect(sent).toEqual([]);
    expect(community.consume).not.toHaveBeenCalled();
  });

  it("kanal posti, avtomatik forward, bot va boshqa guruh — e'tiborsiz (eslatma bo'lsa ham)", async () => {
    const { d, methods } = setup();
    const t = "@femidaedu_bot mehnat ta'tili qancha?";
    await handleUpdate(groupMsg({ text: t, sender_chat: { id: -100123 } }), d);
    await handleUpdate(groupMsg({ text: t, is_automatic_forward: true }), d);
    await handleUpdate(groupMsg({ text: t, from: { id: 5, is_bot: true } }), d);
    await handleUpdate(groupMsg({ text: t, chat: { id: -100999, type: "supergroup" } }), d);
    expect(methods()).toEqual([]);
  });

  it("community berilmasa — guruh xabari umuman ishlanmaydi", async () => {
    const { d, methods } = setup();
    await handleUpdate(groupMsg({ text: "@femidaedu_bot savol" }), { ...d, community: undefined });
    expect(methods()).toEqual([]);
  });
});

describe("guruhda javob", () => {
  it("@eslatma — typing, AI javobi reply sifatida, HTML qochirilgan, bot tugmasi", async () => {
    const { d, community, calls } = setup();
    await handleUpdate(groupMsg({ text: "@FemidaEdu_Bot mehnat shartnomasi qanday tuziladi?" }), d);
    expect(community.answer).toHaveBeenCalledWith("mehnat shartnomasi qanday tuziladi?", null);
    expect(calls.map((c) => c.method)).toEqual(["sendChatAction", "sendMessage"]);
    const p = calls[1].params;
    expect(p.chat_id).toBe(CHAT);
    expect(p.text).toContain("&lt;b&gt;");
    expect(p.reply_parameters).toEqual({ message_id: 10, allow_sending_without_reply: true });
    expect(JSON.stringify(p.reply_markup)).toContain("https://t.me/femidaedu_bot?start=hamjamiyat");
  });

  it("bot xabariga javob — iqtibos kontekst sifatida", async () => {
    const { d, community } = setup();
    await handleUpdate(groupMsg({ text: "Misol keltiring", reply_to_message: { message_id: 3, from: { id: BOT_ID, is_bot: true }, text: "Avvalgi javob" } }), d);
    expect(community.answer).toHaveBeenCalledWith("Misol keltiring", "Avvalgi javob");
  });

  it("boshqa odamga javob (eslatmasiz) — jim; o'xshash username — jim", async () => {
    const { d, methods } = setup();
    await handleUpdate(groupMsg({ text: "rozi", reply_to_message: { message_id: 3, from: { id: 55 } } }), d);
    await handleUpdate(groupMsg({ text: "@femidaedu_bot_fan qalaysan" }), d);
    expect(methods()).toEqual([]);
  });

  it("limit tugagan — jim (typing ham yo'q); AI xatosi — jim", async () => {
    const a = setup({ consume: vi.fn(async () => false) });
    await handleUpdate(groupMsg({ text: "@femidaedu_bot savol" }), a.d);
    expect(a.methods()).toEqual([]);
    const b = setup({ answer: vi.fn(async () => null) });
    await handleUpdate(groupMsg({ text: "@femidaedu_bot savol" }), b.d);
    expect(b.methods()).toEqual(["sendChatAction"]);
  });

  it("faqat eslatma, savolsiz — jim", async () => {
    const { d, methods } = setup();
    await handleUpdate(groupMsg({ text: "@femidaedu_bot" }), d);
    expect(methods()).toEqual([]);
  });

  it("isAddressed: rasm izohidagi eslatma ham", () => {
    expect(isAddressed({ message_id: 1, chat: { id: CHAT, type: "supergroup" }, caption: "@femidaedu_bot bu nima?" }, { botId: BOT_ID, username: "femidaedu_bot" })).toBe(true);
  });
});

describe("qo'shilish so'rovlari", () => {
  const join = (id: number, chat = CHAT): Update => ({ update_id: 2, chat_join_request: { chat: { id: chat, type: "supergroup" }, from: { id } } });

  it("profili bor — tasdiqlanadi; yo'q — hech narsa; boshqa guruh — e'tiborsiz", async () => {
    const { d, calls } = setup();
    await handleUpdate(join(42), d);
    await handleUpdate(join(7), d);
    await handleUpdate(join(42, -100555), d);
    expect(calls).toEqual([{ method: "approveChatJoinRequest", params: { chat_id: CHAT, user_id: 42 } }]);
  });

  it("shaxsiy /start (har qanday payload) — so'rov tasdiqlanadi, xatosi yutiladi, odatiy javob davom etadi", async () => {
    const { d, calls, sent } = setup();
    await handleUpdate({ update_id: 3, message: { message_id: 1, from: { id: 999, first_name: "Vali" }, chat: { id: 999, type: "private" }, text: "/start hamjamiyat" } }, d);
    expect(calls[0]).toEqual({ method: "approveChatJoinRequest", params: { chat_id: CHAT, user_id: 999 } });
    expect(sent).toHaveLength(1);
    expect(sent[0].html).toContain("Assalomu alaykum");
  });

  it("boshqa buyruqlar so'rovni tasdiqlamaydi", async () => {
    const { d, methods } = setup();
    await handleUpdate({ update_id: 4, message: { message_id: 1, from: { id: 42 }, chat: { id: 42, type: "private" }, text: "/kunlik" } }, d);
    expect(methods()).not.toContain("approveChatJoinRequest");
  });
});

describe("kunlik post", () => {
  // 13:05 UTC = 18:05 Toshkent
  const at = (iso: string) => new Date(iso);
  function post(now: Date) {
    const claimed = new Set<string>();
    const sent: { chat: number; html: string; opts?: unknown }[] = [];
    const api = { call: vi.fn(), sendMessage: vi.fn(async (chat: number, html: string, opts?: unknown) => void sent.push({ chat, html, opts })) } as unknown as BotApi;
    const d: DailyPostDeps = {
      api, chatId: CHAT, username: "femidaedu_bot", now,
      claim: async (day) => (claimed.has(day) ? false : (claimed.add(day), true)),
      release: async (day) => void claimed.delete(day),
      tip: async () => ({ text: "Ta'til <yillik> 21 kun.", source: "MK 134-modda" }),
    };
    return { d, sent, claimed };
  }

  it("18:00 da bitta post; ikkinchi chaqiruv — takror yo'q", async () => {
    const { d, sent } = post(at("2026-10-08T13:05:00Z"));
    expect(await postDailyTip(d)).toBe("posted");
    expect(await postDailyTip(d)).toBe("duplicate");
    expect(sent).toHaveLength(1);
    expect(sent[0].chat).toBe(CHAT);
    expect(sent[0].html).toContain("&lt;yillik&gt;");
    expect(sent[0].html).toContain("MK 134-modda");
    expect(JSON.stringify(sent[0].opts)).toContain("start=hamjamiyat");
  });

  it("20:00–22:00 va boshqa soatlarda post yo'q", async () => {
    for (const iso of ["2026-10-08T15:30:00Z", "2026-10-08T16:59:00Z", "2026-10-08T05:00:00Z"]) {
      const { d, sent } = post(at(iso));
      expect(await postDailyTip(d)).toBe("outside_hours");
      expect(sent).toHaveLength(0);
    }
  });

  it("yuborish xatosi — bandlik bo'shatiladi", async () => {
    const { d, claimed } = post(at("2026-10-08T13:05:00Z"));
    d.api.sendMessage = vi.fn(async () => { throw new Error("429"); });
    await expect(postDailyTip(d)).rejects.toThrow("429");
    expect(claimed.size).toBe(0);
  });

  it("tashkentClock va fallbackTip", () => {
    expect(tashkentClock(at("2026-10-08T19:30:00Z"))).toEqual({ day: "2026-10-09", hour: 0 });
    expect(FALLBACK_TIPS).toContain(fallbackTip("2026-10-08"));
    expect(fallbackTip("2026-10-08")).not.toBe(fallbackTip("2026-10-09"));
  });
});

describe("yordamchilar", () => {
  it("clipAnswer: Markdown olib tashlanadi, uzun matn so'z chegarasida kesiladi", () => {
    expect(clipAnswer("**Qoida:** ## sarlavha")).toBe("Qoida: ## sarlavha");
    const long = clipAnswer("so'z ".repeat(400));
    expect(long.length).toBeLessThanOrEqual(ANSWER_MAX);
    expect(long.endsWith("so'z…")).toBe(true);
  });

  it("hamjamiyatChatId: env yoki standart", () => {
    vi.stubEnv("HAMJAMIYAT_CHAT_ID", "");
    expect(hamjamiyatChatId()).toBe(HAMJAMIYAT_DEFAULT_ID);
    vi.stubEnv("HAMJAMIYAT_CHAT_ID", "-100123");
    expect(hamjamiyatChatId()).toBe(-100123);
    vi.unstubAllEnvs();
  });
});
