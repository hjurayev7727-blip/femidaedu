// Escrow: komissiya va ruxsat etilgan amallar.
import { describe, expect, it } from "vitest";
import { CommissionSchema, commission, orderActions } from "@/lib/escrow";

describe("komissiya", () => {
  it("kamida 20%, yuqoriga yaxlitlanadi, jami saqlanadi", () => {
    expect(commission(300000, 10)).toEqual({ pct: 20, commission: 60000, payout: 240000 });
    expect(commission(100001, 25)).toEqual({ pct: 25, commission: 25001, payout: 75000 });
    expect(CommissionSchema.safeParse(15).success).toBe(false);
    expect(CommissionSchema.parse("22")).toBe(22);
  });
});

describe("amallar", () => {
  const now = Date.parse("2026-10-01T12:00:00Z");
  it("mijoz va yurist", () => {
    expect(orderActions({ role: "client", status: "awaiting_payment", release_after: null, reviewed: false }, now)).toMatchObject({ pay: true, cancel: true, confirm: false });
    expect(orderActions({ role: "client", status: "delivered", release_after: "2026-10-02T00:00:00Z", reviewed: false }, now)).toMatchObject({ confirm: true, dispute: true });
    expect(orderActions({ role: "client", status: "delivered", release_after: "2026-10-01T00:00:00Z", reviewed: false }, now).dispute).toBe(false);
    expect(orderActions({ role: "client", status: "released", release_after: null, reviewed: true }, now).review).toBe(false);
    expect(orderActions({ role: "lawyer", status: "held", release_after: null, reviewed: false }, now)).toMatchObject({ deliver: true, confirm: false, pay: false });
  });
});
