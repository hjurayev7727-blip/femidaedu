// Qonun matnini (lex.uz sahifasi yoki nusxalangan matn) bob va moddalarga ajratish.
// Kontent lotinda saqlanadi: kirill matn avval lotinga o'giriladi.
import { cyrillicToLatin } from "@/lib/translit";

export type LawChapter = { number: string; title: string; sort: number };
export type LawArticle = { number: string; title: string; body: string; chapter: string | null; sort: number };
export type ParsedLaw = { chapters: LawChapter[]; articles: LawArticle[]; warnings: string[] };

const DASH = "[-–—]";
// "28-modda." / "245-1-modda." / "28 - modda" (lotin, kirilldan o'girilgandan keyin)
const NOT_LETTER = "(?![a-zʻʼ'‘’])";
const ARTICLE = new RegExp(`^(\\d+(?:${DASH}\\d+)*)\\s*${DASH}\\s*modda${NOT_LETTER}\\.?\\s*(.*)$`, "i");
// "1-bob." / "XII bob." / "3 - BOB"
const CHAPTER = new RegExp(`^(\\d+|[IVXLC]+)\\s*${DASH}?\\s*bob${NOT_LETTER}\\.?\\s*(.*)$`, "i");
// "I bo'lim" / "Birinchi bo'lim" — bo'limlar sarlavha sifatida o'tkazib yuboriladi
const SECTION = /^(?:[IVXLC]+|\d+|[a-zʻ'‘’]+)\s*[-–—]?\s*bo['‘’ʻʼ]?lim\b/i;

const cleanTitle = (s: string) => s.replace(/^[-–—.:\s]+/, "").trim();
const hasCyrillic = (s: string) => /[\u0400-\u04FF]/.test(s);

/** Matn bir xil bo'lishi uchun: \r, ortiqcha bo'shliq, nbsp, turli tire */
function normalizeLine(line: string) {
  return line.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();
}

export function parseLawText(input: string): ParsedLaw {
  const text = hasCyrillic(input) ? cyrillicToLatin(input) : input;
  const lines = text.split(/\r?\n/).map(normalizeLine);
  const chapters: LawChapter[] = [];
  const articles: LawArticle[] = [];
  const warnings: string[] = [];
  let chapter: string | null = null;
  let current: { number: string; title: string; body: string[] } | null = null;
  const seen = new Set<string>();

  const flush = () => {
    if (!current) return;
    const body = current.body.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (seen.has(current.number)) warnings.push(`${current.number}-modda ikki marta uchradi — ikkinchisi o'tkazib yuborildi`);
    else if (!body && !current.title) warnings.push(`${current.number}-modda bo'sh`);
    else {
      seen.add(current.number);
      articles.push({ number: current.number, title: current.title, body, chapter, sort: articles.length + 1 });
    }
    current = null;
  };

  for (const line of lines) {
    const a = ARTICLE.exec(line);
    if (a) {
      flush();
      current = { number: a[1].replace(/[–—]/g, "-"), title: cleanTitle(a[2]), body: [] };
      continue;
    }
    const c = CHAPTER.exec(line);
    if (c && line.length < 200) {
      flush();
      const number = c[1].toUpperCase();
      chapter = number;
      if (!chapters.some((x) => x.number === number)) chapters.push({ number, title: cleanTitle(c[2]), sort: chapters.length + 1 });
      continue;
    }
    if (SECTION.test(line) && line.length < 200) {
      flush();
      continue;
    }
    if (current) current.body.push(line);
  }
  flush();
  if (!articles.length) warnings.push("Birorta ham modda topilmadi — matn formati kutilganidek emas");
  return { chapters, articles, warnings };
}

/** lex.uz HTML sahifasidan o'qiladigan matn: skript/uslublarsiz, blok teglar — yangi qator */
export function htmlToText(html: string): string {
  const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", laquo: "«", raquo: "»", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return entities[e.toLowerCase()] ?? m;
    })
    .split("\n")
    .map(normalizeLine)
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join("\n")
    .trim();
}

const LEX_ELEM = /<div class="([A-Z_0-9]+) lx_elem"[\s\S]*?<div name="-?\d+" id="-?\d+">([\s\S]*?)<\/div>/g;

/**
 * lex.uz hujjat sahifasi → parseLawText uchun qatorlar, sahifa tuzilmasi bo'yicha: TEXT_HEADER_DEFAULT (faqat boblar),
 * CLAUSE_DEFAULT (modda sarlavhasi), ACT_TEXT (modda matni). Mundarija havolalari va interfeys yozuvlari (sharh, audio)
 * olinmaydi — aks holda mundarijadagi "N-modda" bo'sh modda bo'lib kirib, haqiqiy modda "takror" deb tashlanadi.
 * Yuqori indeks (4<sup>1</sup>) → "4-1". Tuzilma topilmasa — butun sahifa matni (htmlToText).
 */
export function lexHtmlToText(html: string): string {
  const lines: string[] = [];
  for (const m of html.matchAll(LEX_ELEM)) {
    const cls = m[1];
    if (cls !== "CLAUSE_DEFAULT" && cls !== "TEXT_HEADER_DEFAULT" && cls !== "ACT_TEXT") continue;
    let text = htmlToText(m[2].replace(/<sup[^>]*>\s*(\d+)\s*<\/sup>/gi, "-$1")).replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (cls === "CLAUSE_DEFAULT") text = text.replace(/(\d)\s*([-–—])\s*(?=\d)/g, "$1$2");
    if (cls === "TEXT_HEADER_DEFAULT" && !CHAPTER.test(text)) continue; // bo'lim / qism sarlavhalari
    lines.push(text);
  }
  return lines.length ? lines.join("\n") : htmlToText(html);
}

/** <title> dan hujjat nomi (sahifa to'g'ri hujjatmi — tekshirish uchun) */
export function lexPageTitle(html: string): string {
  const m = /<title>([\s\S]*?)<\/title>/i.exec(html);
  return m ? htmlToText(m[1]).replace(/\s+/g, " ").trim() : "";
}
