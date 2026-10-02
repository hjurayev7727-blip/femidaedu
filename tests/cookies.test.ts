import { createServerClient } from "@supabase/ssr";
import { describe, expect, it } from "vitest";
import { isSameOrigin, sessionCookieOptions } from "@/lib/supabase/cookies";

const SITE = "https://femidaedu.vercel.app";

describe("sessiya cookie parametrlari", () => {
  it("HTTPS'da Telegram Web iframe uchun SameSite=None + Partitioned, localhost'da standart", () => {
    expect(sessionCookieOptions(SITE)).toEqual({ sameSite: "none", secure: true, partitioned: true });
    expect(sessionCookieOptions("http://localhost:3000")).toEqual({});
  });

  it("@supabase/ssr ularni sessiya cookie'siga qo'llaydi", async () => {
    const written: { name: string; options: Record<string, unknown> }[] = [];
    const supabase = createServerClient("https://x.supabase.co", "sb_publishable_test", {
      cookieOptions: sessionCookieOptions(SITE),
      cookies: {
        getAll: () => [{ name: "sb-x-auth-token", value: "eski" }],
        setAll: (list) => list.forEach(({ name, options }) => written.push({ name, options })),
      },
    });
    await supabase.auth.signOut({ scope: "local" });
    expect(written.length).toBeGreaterThan(0);
    for (const w of written) expect(w.options).toMatchObject({ sameSite: "none", secure: true, partitioned: true, path: "/" });
  });
});

describe("isSameOrigin", () => {
  const req = (origin?: string) =>
    new Request(`${SITE}/auth/chiqish`, { method: "POST", headers: origin ? { origin } : {} });
  it("o'z saytimizdan — ha; begona yoki Origin'siz — yo'q", () => {
    expect(isSameOrigin(req(SITE), SITE)).toBe(true);
    expect(isSameOrigin(req("https://evil.example"), SITE)).toBe(false);
    expect(isSameOrigin(req("https://web.telegram.org"), SITE)).toBe(false);
    expect(isSameOrigin(req(), SITE)).toBe(false);
  });
});
