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

describe("lexHtmlToText (lex.uz sahifa tuzilmasi)", () => {
  const ui = `<div class="lx_elem2"><div class="lx_elem3"><span onclick="lx_sf(-1)"><img src="/img/cmt.svg" />Ҳужжатга таклиф юбориш</span></div></div>`;
  const el = (cls: string, id: number, text: string) => `<div class="${cls} lx_elem" onmousemove="lx_mo(event,-${id})">${ui}<div name="-${id}" id="-${id}">${text}</div></div>`;
  const page = `<html><head><title>&nbsp; 28.10.2022.&nbsp;Oʻzbekiston Respublikasining Mehnat kodeksi</title></head><body>
    <div class="docNavbar__item"><p><a class="search-text" href="javascript:scrollText('-3');">1-modda. Mundarijadagi havola</a></p></div>
    ${el("ACT_TITLE", 1, "Oʻzbekiston Respublikasining Mehnat kodeksi")}
    ${el("TEXT_HEADER_DEFAULT", 2, "I BOʻLIM. UMUMIY QOIDALAR")}
    ${el("TEXT_HEADER_DEFAULT", 3, "1-bob. Asosiy qoidalar")}
    ${el("CLAUSE_DEFAULT", 4, "1-modda. Munosabatlar")}
    <div class="INDEXES_ON_REF lx_no_select" style="display:none"><div name="onLBC-5" id="onLBC-5">[OKOZ: yashirin]</div></div>
    ${el("ACT_TEXT", 5, "Birinchi xatboshi &laquo;matn&raquo;.")}
    ${el("ACT_TEXT", 6, "Ikkinchi xatboshi.")}
    ${el("TEXT_HEADER_DEFAULT", 7, "UMUMIY QISM")}
    ${el("CLAUSE_DEFAULT", 8, "4<sup>1</sup>-modda. Qo'shimcha modda")}
    ${el("ACT_TEXT", 9, "Matn.")}
    ${el("CLAUSE_DEFAULT", 10, "244 <sup>3</sup> -modda. Bo'shliqli raqam")}
    ${el("ACT_TEXT", 11, "Oxirgi.")}
  </body></html>`;

  it("mundarija, UI yozuvlari, yashirin indekslar va bo'lim sarlavhalari kirmaydi; yuqori indeks → tire", async () => {
    const { lexHtmlToText, lexPageTitle } = await import("@/lib/lex/parse");
    const text = lexHtmlToText(page);
    expect(text).not.toContain("Mundarijadagi");
    expect(text).not.toContain("таклиф");
    expect(text).not.toContain("OKOZ");
    expect(text).not.toContain("UMUMIY QISM");
    const p = parseLawText(text);
    expect(p.warnings).toEqual([]);
    expect(p.chapters).toEqual([{ number: "1", title: "Asosiy qoidalar", sort: 1 }]);
    expect(p.articles.map((a) => [a.number, a.title, a.body])).toEqual([
      ["1", "Munosabatlar", "Birinchi xatboshi «matn».\nIkkinchi xatboshi."],
      ["4-1", "Qo'shimcha modda", "Matn."],
      ["244-3", "Bo'shliqli raqam", "Oxirgi."],
    ]);
    expect(lexPageTitle(page)).toContain("Mehnat kodeksi");
  });
});
