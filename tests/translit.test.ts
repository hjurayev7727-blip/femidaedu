import { describe, expect, it } from "vitest";
import { cyrillicToLatin, latinToCyrillic } from "@/lib/translit";

describe("latinToCyrillic", () => {
  it.each([
    ["O‘zbekiston Respublikasi", "Ўзбекистон Республикаси"],
    ["Davlat bayrog‘i to‘g‘risida", "Давлат байроғи тўғрисида"],
    ["shaxs va jamiyat", "шахс ва жамият"],
    ["Konstitutsiya, Konstitutsiyaviy", "Конституция, Конституциявий"],
    ["tsex", "тсех"],
    ["yer, yetti, poyezd", "ер, етти, поезд"],
    ["Ekologiya, ekspert", "Экология, эксперт"],
    ["ma’muriy javobgarlik", "маъмурий жавобгарлик"],
    ["Qonunchilik palatasi", "Қонунчилик палатаси"],
    ["choy, yoshlar, yuridik, yaxshi", "чой, ёшлар, юридик, яхши"],
    ["155-modda, 1992-yil 8-dekabr", "155-модда, 1992-йил 8-декабр"],
    ["SHAXS", "ШАХС"],
    ["Hokimiyat", "Ҳокимият"],
  ])("%s → %s", (lat, cyr) => expect(latinToCyrillic(lat)).toBe(cyr));
});

describe("cyrillicToLatin", () => {
  it.each([
    ["Ўзбекистон", "O'zbekiston"],
    ["тўғрисида", "to'g'risida"],
    ["шахс", "shaxs"],
    ["ер", "yer"],
    ["маъмурий", "ma'muriy"],
    ["Экология", "Ekologiya"],
    ["Ҳокимият", "Hokimiyat"],
  ])("%s → %s", (cyr, lat) => expect(cyrillicToLatin(cyr)).toBe(lat));
});
