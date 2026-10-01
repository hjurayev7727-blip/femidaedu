// Yuristlar: kontaktlarni yashirish va profil shakli.
import { describe, expect, it } from "vitest";
import { experienceLabel, fmtSum, LawyerProfileSchema, maskContacts, staleLicensePaths } from "@/lib/lawyers";

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

  it.each([
    ["display_name", "Aziz t.me/aziz_yurist", "Ism-familiya"],
    ["headline", "Qo'ng'iroq qiling: +998 90 123 45 67", "Qisqa tavsif"],
    ["bio", "Yozing: @aziz_yurist yoki aziz@mail.uz", "O'zingiz haqingizda"],
  ])("ochiq matnda kontakt rad etiladi (to'lovni chetlab o'tmaslik uchun): %s", (key, value, label) => {
    const r = LawyerProfileSchema.safeParse({ ...base, [key]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ path: [key] });
    expect(r.error?.issues[0]?.message).toContain(`${label}: telefon, Telegram yoki email yozmang`);
  });

  it("kontaktsiz oddiy matn o'tadi (modda raqamlari, yillar, narx)", () => {
    const bio = "2014-2020 yillarda sudda ishlaganman. MK 161-modda bo'yicha nizolar, maslahat 500 000 so'mdan.";
    expect(LawyerProfileSchema.safeParse({ ...base, headline: "Mehnat nizolari", bio }).success).toBe(true);
  });

  it("ko'rinish", () => {
    expect(fmtSum(1500000)).toBe("1 500 000 so'm");
    expect(experienceLabel(0)).toBe("Tajriba: 1 yilgacha");
    expect(experienceLabel(null)).toBeNull();
  });
});

describe("guvohnoma fayllarini tozalash", () => {
  it("ko'rib chiqilayotgan arizaniki va yangi yuklanganlar qoladi, qolgani o'chiriladi", () => {
    const now = Date.parse("2026-10-01T12:00:00Z");
    const cutoff = now - 60 * 60 * 1000;
    const files = [
      { path: "u1/a.jpg", created_at: "2026-10-01T09:00:00Z" }, // ko'rib chiqilmoqda
      { path: "u1/b.jpg", created_at: "2026-10-01T09:00:00Z" }, // yuborilmay qolgan
      { path: "u2/c.pdf", created_at: "2026-10-01T11:30:00Z" }, // hozirgina yuklangan
      { path: "u3/d.png", created_at: null },
    ];
    expect(staleLicensePaths(files, new Set(["u1/a.jpg"]), cutoff)).toEqual(["u1/b.jpg"]);
  });
});
