// Qonun matnini bob/moddalarga ajratish: lotin va kirill, murakkab raqamlar, tuzoqlar, HTML.
import { describe, expect, it } from "vitest";
import { htmlToText, parseLawText } from "@/lib/lex/parse";

const LATIN = `
O'ZBEKISTON RESPUBLIKASINING MEHNAT KODEKSI
I bo'lim. Umumiy qoidalar
1-bob. Asosiy qoidalar
1-modda. Mehnat qonunchiligining vazifalari
Mehnat qonunchiligi xodimlar va ish beruvchilar manfaatlarini muvofiqlashtiradi.
Ikkinchi xatboshi.
2-modda. Asosiy tamoyillar
28-moddada nazarda tutilgan hollar bundan mustasno.
2-bob. Mehnat shartnomasi
245-1-modda. Masofaviy ish
Masofaviy ish shartnoma asosida belgilanadi.
`;

const CYRILLIC = `
1-боб. Умумий қоидалар
1-модда. Қонуннинг мақсади
Ушбу Қонуннинг мақсади оила муносабатларини тартибга солишдан иборат.
`;

describe("parseLawText", () => {
  it("bob va moddalarni ajratadi, bo'limni o'tkazib yuboradi", () => {
    const p = parseLawText(LATIN);
    expect(p.chapters.map((c) => [c.number, c.title])).toEqual([["1", "Asosiy qoidalar"], ["2", "Mehnat shartnomasi"]]);
    expect(p.articles.map((a) => [a.number, a.chapter, a.sort])).toEqual([["1", "1", 1], ["2", "1", 2], ["245-1", "2", 3]]);
    expect(p.articles[0].title).toBe("Mehnat qonunchiligining vazifalari");
    expect(p.articles[0].body).toBe("Mehnat qonunchiligi xodimlar va ish beruvchilar manfaatlarini muvofiqlashtiradi.\nIkkinchi xatboshi.");
    expect(p.warnings).toEqual([]);
  });

  it("\"28-moddada …\" bilan boshlangan qator yangi modda emas", () => {
    const p = parseLawText(LATIN);
    expect(p.articles.find((a) => a.number === "28")).toBeUndefined();
    expect(p.articles[1].body).toContain("28-moddada nazarda tutilgan");
  });

  it("kirill matnni lotinga o'girib ajratadi", () => {
    const p = parseLawText(CYRILLIC);
    expect(p.chapters[0].number).toBe("1");
    expect(p.articles).toHaveLength(1);
    expect(p.articles[0].title.toLowerCase()).toContain("qonunning maqsadi");
    expect(p.articles[0].body).toMatch(/^Ushbu Qonunning maqsadi/);
  });

  it("takroriy va bo'sh moddalar ogohlantirish beradi, modda yo'q bo'lsa ham", () => {
    expect(parseLawText("1-modda. A\nmatn\n1-modda. A\nboshqa").warnings[0]).toMatch(/ikki marta/);
    expect(parseLawText("oddiy matn").warnings[0]).toMatch(/modda topilmadi/);
  });

  it("uzun tire va rim raqamli boblar", () => {
    const p = parseLawText("XII bob — Yakuniy qoidalar\n12–1-modda. Kuchga kirish\nMatn.");
    expect(p.chapters[0]).toMatchObject({ number: "XII", title: "Yakuniy qoidalar" });
    expect(p.articles[0].number).toBe("12-1");
  });
});

describe("htmlToText", () => {
  it("teglar, skriptlar va entity'lar", () => {
    const t = htmlToText(`<html><script>var x=1</script><div class="ACT_TEXT"><p>1-modda.&nbsp;Nom</p><p>Matn &laquo;qo&#8216;shtirnoq&raquo;<br>davomi</p></div></html>`);
    expect(t).toBe("1-modda. Nom\nMatn «qo‘shtirnoq»\ndavomi");
  });
});
