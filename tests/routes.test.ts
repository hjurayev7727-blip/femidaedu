// Tashqi dunyoga ochiq marshrutlarning xavfsizlik darvozalari: webhook, cron, Mini App kirish.
import { createHmac } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const SECRET = "s".repeat(32);
const TOKEN = "123456:TEST-bot-token";
const SITE = "https://aplus.test";

function baseEnv(extra: Record<string, string> = {}) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://x.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_xxxxxxxxxxxxxxxx");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_xxxxxxxxxxxxxxxxxxxx");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", SITE);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", TOKEN);
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("POST /api/bot (webhook)", () => {
  const req = (secret?: string, body: unknown = { update_id: 1 }) =>
    new NextRequest(`${SITE}/api/bot`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-telegram-bot-api-secret-token": secret } : {}) },
      body: JSON.stringify(body),
    });

  it("secret sozlanmagan — 503", async () => {
    baseEnv();
    const { POST } = await import("@/app/api/bot/route");
    expect((await POST(req(SECRET))).status).toBe(503);
  });

  it("secret yo'q yoki noto'g'ri — 403", async () => {
    baseEnv({ TELEGRAM_WEBHOOK_SECRET: SECRET });
    const { POST } = await import("@/app/api/bot/route");
    expect((await POST(req())).status).toBe(403);
    expect((await POST(req("x".repeat(32)))).status).toBe(403);
  });

  it("to'g'ri secret — 200 (bo'sh yangilanish)", async () => {
    baseEnv({ TELEGRAM_WEBHOOK_SECRET: SECRET });
    const { POST } = await import("@/app/api/bot/route");
    expect((await POST(req(SECRET))).status).toBe(200);
  });
});

describe("GET /api/cron/eslatma", () => {
  const req = (auth?: string, slot = "morning") =>
    new NextRequest(`${SITE}/api/cron/eslatma?slot=${slot}`, { headers: auth ? { authorization: `Bearer ${auth}` } : {} });

  it("CRON_SECRET yo'q — 503; noto'g'ri — 403; noma'lum slot — 400", async () => {
    baseEnv({ TELEGRAM_WEBHOOK_SECRET: SECRET });
    let { GET } = await import("@/app/api/cron/eslatma/route");
    expect((await GET(req(SECRET))).status).toBe(503);

    vi.resetModules();
    vi.stubEnv("CRON_SECRET", SECRET);
    ({ GET } = await import("@/app/api/cron/eslatma/route"));
    expect((await GET(req())).status).toBe(403);
    expect((await GET(req("y".repeat(32)))).status).toBe(403);
    expect((await GET(req(SECRET, "tunda"))).status).toBe(400);
  });
});

describe("POST /api/auth/telegram-webapp", () => {
  function initData(token = TOKEN) {
    const fields = { user: JSON.stringify({ id: 42, first_name: "Ali" }), auth_date: String(Math.floor(Date.now() / 1000)) };
    const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k as keyof typeof fields]}`).join("\n");
    const key = createHmac("sha256", "WebAppData").update(token).digest();
    return new URLSearchParams({ ...fields, hash: createHmac("sha256", key).update(dcs).digest("hex") }).toString();
  }
  const req = (origin: string | null, body: unknown) =>
    new NextRequest(`${SITE}/api/auth/telegram-webapp`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify(body),
    });

  it("begona sahifadan (Origin) — 403 (login CSRF)", async () => {
    baseEnv();
    const { POST } = await import("@/app/api/auth/telegram-webapp/route");
    expect((await POST(req("https://evil.example", { initData: initData() }))).status).toBe(403);
    expect((await POST(req(null, { initData: initData() }))).status).toBe(403);
  });

  it("boshqa bot tokeni bilan imzolangan initData — 401", async () => {
    baseEnv();
    const { POST } = await import("@/app/api/auth/telegram-webapp/route");
    const r = await POST(req(SITE, { initData: initData("999:other") }));
    expect(r.status).toBe(401);
  });

  it("noto'g'ri tana — 400", async () => {
    baseEnv();
    const { POST } = await import("@/app/api/auth/telegram-webapp/route");
    expect((await POST(req(SITE, { x: 1 }))).status).toBe(400);
  });
});

describe("GET /api/auth/telegram (widget)", () => {
  const req = (query: string, cookie?: string) =>
    new NextRequest(`${SITE}/api/auth/telegram?${query}`, { headers: cookie ? { cookie } : {} });

  it("state cookie yo'q yoki mos emas — kirish rad etiladi (login CSRF)", async () => {
    baseEnv();
    const { GET } = await import("@/app/api/auth/telegram/route");
    for (const r of [req("id=1&hash=x"), req("id=1&hash=x&s=abc"), req("id=1&hash=x&s=abc", "tg_state=boshqa")]) {
      const res = await GET(r);
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/kirish?xato=sessiya");
    }
  });

  it("state mos, lekin imzo noto'g'ri — telegram_imzo", async () => {
    baseEnv();
    const { GET } = await import("@/app/api/auth/telegram/route");
    const res = await GET(req("id=1&hash=00&auth_date=1&s=abc", "tg_state=abc"));
    expect(res.headers.get("location")).toContain("/kirish?xato=telegram_imzo");
  });
});
