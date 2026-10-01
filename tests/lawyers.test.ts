// Yuristlar: kontaktlarni yashirish va profil shakli.
import { describe, expect, it } from "vitest";
import { experienceLabel, fmtSum, LawyerProfileSchema, maskContacts } from "@/lib/lawyers";

describe("kontaktlarni yashirish", () => {
  it.each([
    ["Menga +998 90 123-45-67 ga qo'ng'iroq qiling", true],
    ["raqamim 901234567", true],
    ["Telegram: @aziz_yurist", true],
    ["https://t.me/aziz_yurist ga yozing", true],
    ["t.me/joinchat/abc", true],
    ["aziz@mail.uz ga yuboring", true],
    ["MK 161-moddasi bo'yicha 3 kun ichida", false],
    ["Narxi 500 000 so'm, 2026-yil 12-oktabr", false],
  ])("%s", (text, masked) => {
    const r = maskContacts(text);
    expect(r.masked).toBe(masked);
    if (masked) expect(r.text).toContain("to'lovdan keyin");
    else expect(r.text).toBe(text);
  });
});

describe("profil shakli", () => {
  const base = { display_name: "Aziz Karimov", fields: ["mehnat"], languages: ["uz"] };
  it("telefon, telegram, karta normallashtiriladi; bo'sh qiymatlar null", () => {
    const r = LawyerProfileSchema.parse({ ...base, phone: "+998 (90) 123-45-67", telegram: "@aziz_yurist", payout_card: "8600 1234 1234 1234", bio: "", region: "" });
    expect(r).toMatchObject({ phone: "+998901234567", telegram: "aziz_yurist", payout_card: "8600123412341234", bio: null, region: null, hidden: false });
    expect(LawyerProfileSchema.safeParse({ ...base, phone: "90 123 45 67" }).success).toBe(false);
    expect(LawyerProfileSchema.safeParse({ ...base, fields: [] }).success).toBe(false);
    expect(LawyerProfileSchema.safeParse({ ...base, region: "Mars" }).success).toBe(false);
  });

  it("ko'rinish", () => {
    expect(fmtSum(1500000)).toBe("1 500 000 so'm");
    expect(experienceLabel(0)).toBe("Tajriba: 1 yilgacha");
    expect(experienceLabel(null)).toBeNull();
  });
});
