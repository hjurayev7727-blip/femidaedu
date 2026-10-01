// Ilova menyusi har sahifada lawyersEnabled() ni chaqiradi — kalit yo'q yoki baza xatosi butun /app ni yiqitmasligi kerak.
import { afterEach, describe, expect, it, vi } from "vitest";

const admin = vi.hoisted(() => ({ impl: (): unknown => null }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseAdmin: () => admin.impl() }));

const settings = (value: unknown, fail = false) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => {
          if (fail) throw new Error("fetch failed");
          return { data: value === undefined ? null : { value }, error: null };
        },
      }),
    }),
  }),
});

afterEach(() => vi.restoreAllMocks());

describe("lawyersEnabled", () => {
  it("faqat true bo'lsa ochiq", async () => {
    const { lawyersEnabled } = await import("@/lib/legal-server");
    admin.impl = () => settings(true);
    expect(await lawyersEnabled()).toBe(true);
    for (const v of [false, "true", 1, undefined]) {
      admin.impl = () => settings(v);
      expect(await lawyersEnabled()).toBe(false);
    }
  });

  it("maxfiy kalit yo'q yoki baza xatosi — yopiq, xato tashlanmaydi", async () => {
    const { lawyersEnabled } = await import("@/lib/legal-server");
    vi.spyOn(console, "error").mockImplementation(() => {});
    admin.impl = () => {
      throw new Error("SUPABASE_SECRET_KEY is required");
    };
    expect(await lawyersEnabled()).toBe(false);
    admin.impl = () => settings(true, true);
    expect(await lawyersEnabled()).toBe(false);
  });
});
