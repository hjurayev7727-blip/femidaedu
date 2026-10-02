// Qonun hujjatini bazaga import qilish (lex.uz sahifasidan yoki nusxalangan matndan).
//   npm run lex:import -- MK                    — data/lex/documents.json dagi kod bo'yicha, lex.uz'dan
//   npm run lex:import -- MK --file mehnat.txt  — lex.uz'dan nusxalangan matndan (sayt yopiq bo'lsa)
//   npm run lex:import -- all                   — ro'yxatdagi hammasi
//   ... --dry                                   — bazaga yozmasdan faqat tahlil (bob/modda soni, ogohlantirishlar)
// Qayta ishga tushirish xavfsiz: o'zgargan moddalar belgilanadi, ularga bog'langan savollar tekshiruvga qaytadi.
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { lexHtmlToText, lexPageTitle, parseLawText, type ParsedLaw } from "../src/lib/lex/parse";

try {
  process.loadEnvFile(".env.local");
} catch {
  // o'zgaruvchilar muhitdan olinadi
}

type Entry = { code: string; field: string; lex_id: string; title: string; short_title: string; expect: string };
const registry = (JSON.parse(readFileSync("data/lex/documents.json", "utf8")) as { documents: Entry[] }).documents;

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const value = (n: string) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
const target = args.find((a, i) => !a.startsWith("--") && args[i - 1] !== "--file");

async function fetchLex(entry: Entry): Promise<string> {
  const res = await fetch(`https://lex.uz/docs/-${entry.lex_id}`, { headers: { "user-agent": "FemidaEdu-import/1.0 (+https://femidaedu.uz)" } });
  if (!res.ok) throw new Error(`lex.uz ${res.status} — ${entry.code}`);
  const html = await res.text();
  const title = lexPageTitle(html);
  if (!title.toLowerCase().replace(/[‘’ʻʼ`]/g, "'").includes(entry.expect)) {
    throw new Error(`${entry.code}: sahifa sarlavhasi "${title}" — "${entry.expect}" emas, lex_id noto'g'ri bo'lishi mumkin (${entry.lex_id})`);
  }
  return html;
}

function report(entry: Entry, p: ParsedLaw) {
  console.log(`${entry.code}: ${p.chapters.length} bob, ${p.articles.length} modda`);
  for (const w of p.warnings.slice(0, 10)) console.log(`  ⚠ ${w}`);
  if (p.warnings.length > 10) console.log(`  … yana ${p.warnings.length - 10} ta ogohlantirish`);
}

async function main() {
  if (!target) throw new Error("Hujjat kodini yozing (masalan MK) yoki 'all'. Ro'yxat: data/lex/documents.json");
  const entries = target === "all" ? registry : registry.filter((e) => e.code === target);
  if (!entries.length) throw new Error(`${target} ro'yxatda yo'q (data/lex/documents.json)`);
  if (value("--file") && entries.length > 1) throw new Error("--file faqat bitta hujjat bilan ishlatiladi");

  const url = process.env.DATABASE_URL;
  const sql = flag("--dry") ? null : url ? postgres(url, { max: 1, prepare: false, onnotice: () => {} }) : null;
  if (!flag("--dry") && !sql) throw new Error("DATABASE_URL topilmadi (.env.local). Tahlil uchun --dry qo'shing.");
  try {
    for (const entry of entries) {
      const file = value("--file");
      const raw = file ? readFileSync(file, "utf8") : await fetchLex(entry);
      const parsed = parseLawText(/<html|<body|<div/i.test(raw) ? lexHtmlToText(raw) : raw);
      report(entry, parsed);
      if (!sql || !parsed.articles.length) continue;
      const payload = { code: entry.code, title: entry.title, short_title: entry.short_title, field: entry.field, lex_id: entry.lex_id, chapters: parsed.chapters, articles: parsed.articles };
      const [r] = await sql<{ r: Record<string, number | boolean> }[]>`select public.import_law_document(${sql.json(payload)}) as r`;
      console.log(`  ✓ ${r.r.created ? "yangi" : "yangilandi"}: +${r.r.inserted}, o'zgargan ${r.r.changed}, bekor ${r.r.repealed}, o'zgarmagan ${r.r.unchanged}; tekshiruvga qaytgan savollar: ${r.r.questions_flagged}`);
    }
  } finally {
    await sql?.end();
  }
}

main().catch((e: Error) => {
  console.error("✗", e.message);
  process.exitCode = 1;
});
