import { describe, expect, it } from "vitest";
import { daysUntil } from "@/lib/dates";

describe("daysUntil", () => {
  const exam = new Date("2026-12-23T09:00:00+05:00");
  it("Toshkent sanasi bo'yicha hisoblaydi", () => {
    expect(daysUntil(exam, new Date("2026-12-22T23:30:00+05:00"))).toBe(1);
    expect(daysUntil(exam, new Date("2026-12-23T00:10:00+05:00"))).toBe(0);
    expect(daysUntil(exam, new Date("2026-09-29T12:00:00+05:00"))).toBe(85);
  });
  it("o'tgan sana uchun 0", () => {
    expect(daysUntil(exam, new Date("2027-01-01T00:00:00+05:00"))).toBe(0);
  });
});

describe("tashkentMonthStart", () => {
  it("Toshkent bo'yicha oy boshi (UTC da hali oldingi oy bo'lsa ham)", async () => {
    const { tashkentMonthStart } = await import("@/lib/dates");
    expect(tashkentMonthStart(new Date("2026-10-31T20:30:00Z"))).toBe(Date.parse("2026-11-01T00:00:00+05:00"));
    expect(tashkentMonthStart(new Date("2026-10-15T10:00:00Z"))).toBe(Date.parse("2026-10-01T00:00:00+05:00"));
  });
});
