// Faqat ishlab chiqish uchun: AI yordamchi sahifalari namuna ma'lumot bilan (Supabase va AI'siz). Production'da mavjud emas.
import { notFound } from "next/navigation";
import { TutorChat, type ChatMessage } from "@/components/tutor/chat";
import { PlanForm, PlanView } from "@/components/tutor/plan";
import { TutorHome } from "@/components/tutor/tutor-home";
import { demoAsk, demoMistakes, demoPlan } from "./actions";

const MESSAGES: ChatMessage[] = [
  { role: "user", content: "Namuna: sinov muddati qancha bo'lishi mumkin?" },
  {
    role: "assistant",
    content: "Namuna javob. Sinov muddati uch oydan oshmaydi (Mehnat kodeksi 120-modda).\n\nMisol: Aziz ishga qabul qilinganda unga 2 oylik sinov muddati belgilandi — bu qonuniy.\n\n- Eslab qolish: \"sinov — uch oy\"",
    sources: [{ id: 3, ref: "Mehnat kodeksi 120-modda", field: "mehnat" }, { id: 4, ref: "Mehnat kodeksi 121-modda", field: "mehnat" }],
  },
];

const PLAN = {
  summary: "Namuna reja: 8 hafta davomida A sohalar va sinov imtihonlari. Zaif moddalar birinchi haftalarda.",
  weeks: [1, 2, 3].map((w) => ({
    week: w, focus: `Namuna fokus ${w}`,
    days: ["Dushanba", "Seshanba"].map((d) => ({ day: d, minutes: 45, tasks: ["Mehnat kodeksi 1-bob moddalarini o'qing", "10 ta takrorlash"] })),
  })),
};

export default async function DevTutor({ searchParams }: PageProps<"/dev/ustoz">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const page = String(sp.sahifa ?? "bosh");
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna ma&apos;lumot (faqat ishlab chiqish uchun).</p>
      {page === "bosh" && (
        <TutorHome
          chat={<TutorChat threadId={null} mode="explain" messages={[]} ask={demoAsk} aiReady pickMode />}
          weekUsed={4} weekLimit={10} premium={false} hasPlan={false} base="/dev/ustoz" mistakesAction={demoMistakes}
          weak={[
            { article_id: 1, number: "105", title: null, doc_title: "Mehnat kodeksi", field_slug: "mehnat", seen: 4, correct: 1 },
            { article_id: 2, number: "12", title: null, doc_title: "Oila kodeksi", field_slug: "oila", seen: 3, correct: 1 },
          ]}
          threads={[{ id: "a", mode: "case", title: "Namuna: ishdan sababsiz bo'shatish", updated_at: "2026-09-30T10:00:00Z" }, { id: "b", mode: "explain", title: "Namuna: nikoh yoshi", updated_at: "2026-09-29T10:00:00Z" }]}
        />
      )}
      {page === "suhbat" && <div className="mx-auto max-w-3xl"><TutorChat threadId="00000000-0000-0000-0000-000000000000" mode="explain" messages={MESSAGES} ask={demoAsk} aiReady /></div>}
      {page === "reja" && (
        <div className="mx-auto max-w-3xl space-y-5">
          <PlanView plan={PLAN} currentWeek={2} />
          <PlanForm action={demoPlan} fields={[{ slug: "mehnat", title: "Mehnat huquqi" }]} defaultExam="2026-12-23" aiReady hasPlan />
        </div>
      )}
    </main>
  );
}
