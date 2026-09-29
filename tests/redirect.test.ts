import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/redirect";

describe("safeNext", () => {
  it("ichki yo'llarni o'tkazadi", () => {
    expect(safeNext("/app/mashq?t=1")).toBe("/app/mashq?t=1");
    expect(safeNext("/ustoz#g")).toBe("/ustoz#g");
  });

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "javascript:alert(1)", "", null, undefined, "app"])(
    "tashqi yoki buzuq manzilni rad etadi: %s",
    (v) => expect(safeNext(v)).toBe("/app"),
  );
});
