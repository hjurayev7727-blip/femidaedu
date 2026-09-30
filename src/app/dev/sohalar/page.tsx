// Faqat ishlab chiqish uchun: sohalar katalogi, soha va modda ko'rinishlari namuna ma'lumot bilan (Supabase'siz).
// Namuna matnlar haqiqiy qonun matni EMAS. Production'da mavjud emas.
import { notFound } from "next/navigation";
import { ArticleView } from "@/components/fields/article-view";
import { FieldView, type FieldArticle } from "@/components/fields/field-view";
import { FieldsGrid, type FieldCard } from "@/components/fields/fields-grid";

const FIELDS: FieldCard[] = [
  { slug: "fuqarolik", title: "Fuqarolik huquqi", priority: "A", color: "#1e3a66", icon: "🤝", documents: 2, articles: 1199, mastered: 84, questions: 612 },
  { slug: "oila", title: "Oila huquqi", priority: "A", color: "#8a3b5c", icon: "👪", documents: 1, articles: 238, mastered: 51, questions: 140 },
  { slug: "jinoyat", title: "Jinoyat huquqi", priority: "A", color: "#7a1f2b", icon: "⚖️", documents: 1, articles: 302, mastered: 12, questions: 205 },
  { slug: "mehnat", title: "Mehnat huquqi", priority: "A", color: "#1f5f4a", icon: "💼", documents: 1, articles: 581, mastered: 190, questions: 330 },
  { slug: "konstitutsiyaviy", title: "Konstitutsiyaviy huquq", priority: "B", color: "#0e2340", icon: "🏛️", documents: 1, articles: 155, mastered: 70, questions: 420 },
  { slug: "yer", title: "Yer huquqi", priority: "B", color: "#4d6b2a", icon: "🌾", documents: 0, articles: 0, mastered: 0, questions: 0 },
  { slug: "bojxona", title: "Bojxona huquqi", priority: "C", color: "#4a4a6b", icon: "🛃", documents: 1, articles: 40, mastered: 3, questions: 25 },
  { slug: "ekologiya", title: "Ekologiya huquqi", priority: "C", color: "#2a6b3a", icon: "🌿", documents: 0, articles: 0, mastered: 0, questions: 0 },
];

const ART = (id: number, number: string, title: string, chapter: number, seen: number, correct: number, extra: Partial<FieldArticle> = {}): FieldArticle =>
  ({ id, number, title, chapter_id: chapter, status: "active", questions: 4, seen, correct, free: chapter === 1, ...extra });
const ARTICLES = [
  ART(1, "1", "Namuna: qonunchilikning vazifalari", 1, 3, 3),
  ART(2, "2", "Namuna: asosiy tamoyillar", 1, 2, 1),
  ART(3, "3", "Namuna: qo'llanish doirasi", 1, 0, 0, { questions: 0 }),
  ART(4, "10", "Namuna: shartnoma tuzish", 2, 3, 0),
  ART(5, "11", "Namuna: shartnoma muddati", 2, 0, 0, { status: "changed" }),
  ART(6, "245-1", "Namuna: masofaviy ish", 2, 0, 0),
];

export default async function DevFields({ searchParams }: PageProps<"/dev/sohalar">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const page = String(sp.sahifa ?? "katalog");
  const base = "/dev/sohalar?sahifa=soha";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna ma&apos;lumot — haqiqiy qonun matni emas (faqat ishlab chiqish uchun).</p>
      {page === "katalog" && <FieldsGrid fields={FIELDS} hrefBase="/dev/sohalar?sahifa=soha&soha=" />}
      {page === "soha" && (
        <FieldView
          field={{ slug: "mehnat", title: "Mehnat huquqi", priority: "A", color: "#1f5f4a", icon: "💼" }}
          view={sp.korinish === "hayotiy" ? "hayotiy" : "kodeks"}
          docs={[{ id: 1, title: "Mehnat kodeksi", short_title: "Mehnat kodeksi", lex_url: "https://lex.uz/docs/-6257288" }]}
          chapters={[{ id: 1, document_id: 1, number: "1", title: "Asosiy qoidalar", sort: 1 }, { id: 2, document_id: 1, number: "2", title: "Mehnat shartnomasi", sort: 2 }]}
          articlesByDoc={new Map([[1, ARTICLES]])}
          topics={[{ id: 1, title: "Ishga kirish", article_ids: [4, 5] }, { id: 2, title: "Masofaviy ish", article_ids: [6] }]}
          hrefBase={base}
        />
      )}
      {page === "modda" && (
        <ArticleView
          article={{ id: 4, number: "10", title: "Namuna: shartnoma tuzish", status: "changed", body: "Bu namuna matn. Haqiqiy modda matni lex.uz'dan import qilinadi.\n\nIkkinchi xatboshi: modda matni xatboshilarga bo'lib ko'rsatiladi, uzun matnlar o'qishga qulay bo'lishi uchun qator oralig'i kattaroq." }}
          field={{ slug: "mehnat", title: "Mehnat huquqi", color: "#1f5f4a" }}
          doc={{ title: "Mehnat kodeksi", short_title: "Mehnat kodeksi", lex_url: "https://lex.uz/docs/-6257288" }}
          prev={{ id: 3, number: "3" }}
          next={{ id: 5, number: "11" }}
          progress={{ seen: 3, correct: 0 }}
          questions={4}
          locked={sp.qulf === "1"}
          action={sp.qulf === "1" ? <a className="btn-gold" href="#">Premium bilan ochish</a> : <button className="btn-primary">Testni boshlash</button>}
          hrefBase={base}
        />
      )}
    </main>
  );
}
