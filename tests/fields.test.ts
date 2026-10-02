import { describe, expect, it } from "vitest";
import { articleHeading, mastery, paragraphs, percent } from "@/lib/fields";

describe("fields yordamchilari", () => {
  it("o'zlashtirish holati SQL qoidasiga mos", () => {
    expect(mastery(0, 0)).toBe("yangi");
    expect(mastery(1, 1)).toBe("organilmoqda");
    expect(mastery(2, 2)).toBe("ozlashtirildi");
    expect(mastery(3, 2)).toBe("ozlashtirildi");
    expect(mastery(4, 2)).toBe("organilmoqda");
    expect(mastery(3, 1)).toBe("zaif");
  });
  it("foiz, sarlavha, xatboshilar", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
    expect(articleHeading({ number: "245-1", title: "Masofaviy ish" })).toBe("245-1-modda. Masofaviy ish");
    expect(articleHeading({ number: "7", title: null })).toBe("7-modda");
    expect(paragraphs("A\n\n B \nC")).toEqual(["A", "B", "C"]);
  });
});
