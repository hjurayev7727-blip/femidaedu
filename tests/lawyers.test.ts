// Yuristlar katalogi (pivot, 4-bosqich): kontaktlarni aniqlash/yashirish, profil sxemasi, normalizatsiya.
import { describe, expect, it } from "vitest";
import {
  CONTACT_MASK, experienceLabel, findContacts, formatPhone, LawyerProfileSchema, lawyerFormInput, maskContacts, normalizePhone,
  normalizeTelegram, ReportSchema,
} from "@/lib/lawyers";

describe("kontaktlar", () => {
  it.each([
    "+998 90 123 45 67",
    "+998901234567",
    "998-90-123-45-67",
    "(90) 123-45-67",
    "90 1234567",
    "901234567",
    "@ali_yurist",
    "t.me/ali_yurist",
    "https://t.me/ali_yurist",
    "telegram.me/ali_yurist",
    "wa.me/998901234567",
    "instagram.com/advokat.uz",
    "www.advokat-ali.uz",
    "ali.valiyev@gmail.com",
  ])("topiladi va yashiriladi: %s", (contact) => {
    const text = `Bog'laning: ${contact} — tez javob beraman`;
    expect(findContacts(text).length).toBeGreaterThan(0);
    const masked = maskContacts(text);
    expect(masked).toContain(CONTACT_MASK);
    expect(masked).not.toContain(contact.replace(/^@/, ""));
    expect(masked.startsWith("Bog'laning: ")).toBe(true);
    expect(masked.endsWith(" — tez javob beraman")).toBe(true);
  });

  it.each([
    "Mehnat kodeksi 161-modda va Fuqarolik kodeksi 544-modda",
    "2015-2023 yillarda sudda ishlaganman",
    "Maslahat narxi 150 000 so'm, 1 soat",
    "Huquqiy hujjatlar lex.uz saytida",
    "Toshkent davlat yuridik universiteti (TDYU), 2012",
    "Email yozish shart emas",
  ])("oddiy matnga tegilmaydi: %s", (text) => {
    expect(findContacts(text)).toEqual([]);
    expect(maskContacts(text)).toBe(text);
  });

  it("bir nechta kontakt — hammasi; @ dan oldingi matn saqlanadi", () => {
    const t = "Tel: 90 123 45 67, tg:@ali_yurist, mail: a@b.uz";
    expect(findContacts(t)).toEqual(["a@b.uz", "@ali_yurist", "90 123 45 67"]);
    expect(maskContacts(t)).toBe(`Tel: ${CONTACT_MASK}, tg:${CONTACT_MASK}, mail: ${CONTACT_MASK}`);
  });
});

describe("normalizatsiya", () => {
  it("telefon", () => {
    expect(normalizePhone("+998 (90) 123-45-67")).toBe("+998901234567");
    expect(normalizePhone("998901234567")).toBe("+998901234567");
    expect(normalizePhone("90 123 45 67")).toBe("+998901234567");
    expect(normalizePhone("  ")).toBeNull();
    expect(normalizePhone("12345")).toBeUndefined();
    expect(normalizePhone("+7 900 123 45 67")).toBeUndefined();
    expect(formatPhone("+998901234567")).toBe("+998 90 123 45 67");
  });

  it("telegram", () => {
    expect(normalizeTelegram("@ali_yurist")).toBe("ali_yurist");
    expect(normalizeTelegram("https://t.me/ali_yurist")).toBe("ali_yurist");
    expect(normalizeTelegram("t.me/Ali_Yurist")).toBe("Ali_Yurist");
    expect(normalizeTelegram("")).toBeNull();
    expect(normalizeTelegram("@ali")).toBeUndefined();
    expect(normalizeTelegram("@1abcdef")).toBeUndefined();
    expect(normalizeTelegram("ali yurist")).toBeUndefined();
  });

  it("tajriba", () => {
    expect(experienceLabel(0)).toBe("Tajriba 1 yildan kam");
    expect(experienceLabel(7)).toBe("7 yil tajriba");
  });
});

function form(over: Record<string, string | string[] | null> = {}) {
  const base: Record<string, string | string[] | null> = {
    kind: "advokat", display_name: "Dilnoza Karimova", headline: "Oilaviy nizolar", bio: "Ajrashish va aliment ishlari.",
    fields: ["oila", "fuqarolik"], region: "Samarqand", experience_years: "8", languages: ["uz", "ru"], price_from_uzs: "150 000",
    phone: "+998 90 123 45 67", telegram: "@dilnoza_adv", visible: "on", ...over,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(base)) {
    if (v === null) continue;
    for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x);
  }
  return lawyerFormInput(fd);
}

describe("profil sxemasi", () => {
  it("to'g'ri forma: narx, telefon va Telegram normallashtiriladi", () => {
    const r = LawyerProfileSchema.parse(form());
    expect(r).toEqual({
      kind: "advokat", display_name: "Dilnoza Karimova", headline: "Oilaviy nizolar", bio: "Ajrashish va aliment ishlari.",
      fields: ["oila", "fuqarolik"], region: "Samarqand", experience_years: 8, languages: ["uz", "ru"], price_from_uzs: 150000,
      phone: "+998901234567", telegram: "dilnoza_adv", visible: true,
    });
  });

  it("ixtiyoriylar: narx bo'sh, faqat Telegram, katalogda yashirin", () => {
    const r = LawyerProfileSchema.parse(form({ price_from_uzs: "", phone: "", visible: null, experience_years: "" }));
    expect(r).toMatchObject({ price_from_uzs: null, phone: null, telegram: "dilnoza_adv", visible: false, experience_years: 0 });
  });

  it.each([
    [{ phone: "", telegram: "" }, "Telefon yoki Telegram"],
    [{ fields: [] }, "Kamida bitta sohani"],
    [{ fields: ["oila", "mehnat", "soliq", "yer", "bank", "jinoyat"] }, "Ko'pi bilan 5"],
    [{ region: "Moskva" }, "Viloyatni"],
    [{ languages: [] }, "Kamida bitta tilni"],
    [{ kind: "notarius" }, "Turini"],
    [{ display_name: "Al" }, "kamida 3"],
    [{ price_from_uzs: "500" }, "kamida 10 000"],
    [{ phone: "12345" }, "Telefon raqami"],
    [{ telegram: "@ab" }, "Telegram"],
    [{ bio: "Qo'ng'iroq qiling: +998 90 123 45 67" }, "Batafsil ma'lumot: telefon"],
    [{ headline: "Yozing @dilnoza_adv" }, "Qisqa tavsif: telefon"],
    [{ display_name: "Dilnoza t.me/dilnoza_adv" }, "Ism-familiya: telefon"],
  ])("rad etiladi: %o", (over, message) => {
    const r = LawyerProfileSchema.safeParse(form(over as Record<string, string | string[]>));
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message).join(" | ")).toContain(message);
  });
});

describe("shikoyat sxemasi", () => {
  it("uuid, sabab turi va izoh uzunligi", () => {
    const lawyer = "00000000-0000-4000-8000-000000000001";
    expect(ReportSchema.safeParse({ lawyer, kind: "fraud", reason: "Pul oldi, javob bermadi" }).success).toBe(true);
    expect(ReportSchema.safeParse({ lawyer: "x", kind: "fraud", reason: "Pul oldi, javob bermadi" }).success).toBe(false);
    expect(ReportSchema.safeParse({ lawyer, kind: "spam", reason: "Pul oldi, javob bermadi" }).success).toBe(false);
    expect(ReportSchema.safeParse({ lawyer, kind: "fraud", reason: "qisqa" }).success).toBe(false);
  });
});
