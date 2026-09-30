// Faqat ishlab chiqish uchun: foydalanuvchi testlari sahifalari namuna ma'lumot bilan (Supabase'siz). Production'da mavjud emas.
import { notFound } from "next/navigation";
import { CreateTestForm } from "@/components/tests/create-form";
import type { EditorItem } from "@/components/tests/item-editor";
import { TestCard, type CardData } from "@/components/tests/test-card";
import { TestEditor } from "@/components/tests/test-editor";
import { TestRunner } from "@/components/tests/test-runner";
import { TestsHome } from "@/components/tests/tests-home";
import type { ClientQuestion } from "@/lib/questions";
import { demoAnswer, demoFinish, demoForm, demoRemove, demoSave, demoStart } from "./actions";

const ITEMS: EditorItem[] = [
  { id: 1, article: "Mehnat kodeksi 105-modda", stats: { answered: 14, correct: 11 },
    input: { type: "single", stem: "Namuna: mehnat shartnomasi qanday shaklda tuziladi?", context: "", options: ["Og'zaki", "Yozma", "Notarial", "Istalgan"], correct: 1, explanation: "Namuna izoh.", article_id: 1, difficulty: 1 } },
  { id: 2, article: null, stats: { answered: 14, correct: 2 },
    input: { type: "case", stem: "Namuna: ish beruvchining harakati qonuniymi?", context: "Namuna vaziyat: Aziz ishga qabul qilindi, lekin shartnoma berilmadi.", options: ["Ha", "Yo'q", "Faqat sud qarori bilan", "Kasaba uyushmasi roziligida"], correct: 1, explanation: "", article_id: null, difficulty: 3 } },
  { id: 3, article: "Mehnat kodeksi 120-modda", stats: null,
    input: { type: "open", stem: "Namuna: sinov muddati necha oydan oshmaydi?", kind: "number", accepted: ["3", "uch"], show: "3", explanation: "", article_id: 3, difficulty: 2 } },
];

const CARD: CardData = {
  id: 1, code: "K7Q2XM", title: "Mehnat shartnomasi — 1-bob", description: "Namuna: ishga qabul, sinov muddati va shartnoma shakli bo'yicha 10 savol.",
  author: "Ism Familiya", trust: 2, is_owner: false, field: { slug: "mehnat", title: "Mehnat huquqi", icon: "💼" }, items: 10, rating: 4.6, rating_n: 23,
  attempts: 148, settings: { timer_min: 15, closes_at: "2026-10-15T18:00:00Z", max_attempts: 2, reveal: "end", guests: true }, own_material: false, my_finished: 0, open_attempt: null,
};

const RUN: ClientQuestion[] = ITEMS.slice(0, 2).map((i, k) => ({
  id: k + 1, type: i.input.type, stem: i.input.stem, context: "context" in i.input ? i.input.context || null : null,
  payload: { options: "options" in i.input ? i.input.options : [] }, difficulty: i.input.difficulty,
}));

export default async function DevTests({ searchParams }: PageProps<"/dev/testlar">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const page = String(sp.sahifa ?? "bosh");
  // eslint-disable-next-line react-hooks/purity -- dev namunasi
  const now = Date.now();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna ma&apos;lumot (faqat ishlab chiqish uchun).</p>
      {page === "bosh" && (
        <TestsHome
          weekUsed={3} weekLimit={10} premium={false} hrefBase="/dev/testlar"
          groupTests={[{ code: "P4M9TX", title: "Oila huquqi — nazorat", group_name: "11-A guruh", items: 20, closes_at: "2026-10-10T18:00:00Z", finished: false }]}
          tests={[
            { id: 1, title: "Mehnat shartnomasi — 1-bob", share_code: "K7Q2XM", visibility: "link", status: "published", attempts_count: 148, rating_sum: 106, rating_n: 23, created_at: "2026-09-28T10:00:00Z", items: 10 },
            { id: 2, title: "Jinoyat kodeksi: jazo turlari", share_code: "H3W8RB", visibility: "private", status: "draft", attempts_count: 0, rating_sum: 0, rating_n: 0, created_at: "2026-09-30T10:00:00Z", items: 15 },
          ]}
        />
      )}
      {page === "yangi" && (
        <div className="mx-auto max-w-3xl">
          <CreateTestForm action={demoForm} premium={false} maxItems={10} aiReady
            documents={[{ id: 1, short_title: "Mehnat kodeksi", field: "Mehnat huquqi" }, { id: 2, short_title: "Oila kodeksi", field: "Oila huquqi" }]}
            chapters={[{ id: 1, document_id: 1, number: "1", title: "Asosiy qoidalar" }, { id: 2, document_id: 1, number: "2", title: "Mehnat shartnomasi" }]}
            initial={{ document: 1, articles: "100-110" }} />
        </div>
      )}
      {page === "tahrir" && (
        <TestEditor
          test={{ id: 1, title: "Mehnat shartnomasi — 1-bob", description: "Namuna tavsif", share_code: "K7Q2XM", visibility: "link", status: "published", group_id: null,
            settings: { timer_min: 15, reveal: "end", guests: true }, own_material: true, moderation: null, field_slug: "mehnat" }}
          items={ITEMS} fields={[{ slug: "mehnat", title: "Mehnat huquqi" }]} groups={[{ id: 1, name: "11-A guruh" }]} trust={0} created={10}
          links={{ web: "https://femidaedu.uz/t/K7Q2XM", telegram: "https://t.me/FemidaEduBot?startapp=t_K7Q2XM" }}
          results={[
            { attempt_id: "a", name: "Ism Familiya", guest: false, score: 80, correct: 8, total: 10, started_at: "2026-09-30T09:00:00Z", finished_at: "2026-09-30T09:12:00Z", regraded: true },
            { attempt_id: "b", name: "Mehmon Ism", guest: true, score: 60, correct: 6, total: 10, started_at: "2026-09-30T10:00:00Z", finished_at: "2026-09-30T10:09:00Z", regraded: false },
            { attempt_id: "c", name: "Ism Familiya 2", guest: false, score: null, correct: 3, total: 10, started_at: "2026-09-30T11:00:00Z", finished_at: null, regraded: false },
          ]}
          actions={{ saveItem: demoSave, removeItem: demoRemove, publish: demoForm }}
        />
      )}
      {page === "karta" && <div className="mx-auto max-w-3xl"><TestCard card={CARD} signedIn={sp.kirgan === "1"} action={demoStart} loginHref="/kirish" now={now} /></div>}
      {page === "ishlash" && (
        <div className="mx-auto max-w-3xl">
          <TestRunner code="K7Q2XM" attemptId="00000000-0000-0000-0000-000000000000" title="Mehnat shartnomasi — 1-bob" reveal="each"
            items={RUN} saved={{}} shown={{}} deadlineMs={now + 14 * 60_000} serverNowMs={now} answer={demoAnswer} finish={demoFinish} />
        </div>
      )}
    </main>
  );
}
