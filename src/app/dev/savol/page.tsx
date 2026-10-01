// Faqat ishlab chiqish uchun: "Savol bering" sahifalari namuna ma'lumot bilan (Supabase va AI'siz). Production'da mavjud emas.
import { notFound } from "next/navigation";
import type { LegalChatMessage } from "@/components/legal/answer-card";
import { LegalChat } from "@/components/legal/legal-chat";
import { demoAnalyze, demoAskLegal, demoUpload } from "./actions";

const MESSAGES: LegalChatMessage[] = [
  { role: "user", content: "Namuna: ish beruvchi 2 oylik maoshimni bermayapti. Qayerga murojaat qilsam bo'ladi?" },
  {
    role: "assistant",
    content: "Namuna javob. Ish haqi kechiktirilishi qonunga zid: u kamida oyiga bir marta to'lanadi (Mehnat kodeksi 161-modda).\n\nQadamlar:\n\n- Ish beruvchiga yozma ariza bering va nusxasini saqlang.\n- 10 kun ichida javob bo'lmasa — davlat mehnat inspeksiyasiga murojaat qiling.\n- Sudga da'vo muddati — 1 yil (Mehnat kodeksi 290-modda).",
    confidence: "high", needsLawyer: false,
    sources: [{ id: 3, ref: "Mehnat kodeksi 161-modda", field: "mehnat" }, { id: 4, ref: "Mehnat kodeksi 290-modda", field: "mehnat" }],
  },
  { role: "user", content: "Hujjatni tahlil qiling", doc: { name: "ijara-shartnomasi.pdf", type: "Uy-joy ijarasi shartnomasi", pages: 3 } },
  {
    role: "assistant",
    content: "Qisqacha: Namuna — 12 oylik kvartira ijarasi shartnomasi.\n\nDiqqat qiling:\n\n- Ijara haqini bir tomonlama oshirish huquqi faqat ijaraga beruvchida (Fuqarolik kodeksi 544-modda).\n- Muddatidan oldin chiqishda 3 oylik jarima belgilangan.\n\nYetishmayotgan yoki noaniq bandlar:\n\n- Garov puli qaytarilish muddati yo'q.\n\nImzolashdan oldin jarima bandini kelishib oling.",
    confidence: "low", needsLawyer: true,
    sources: [{ id: 5, ref: "Fuqarolik kodeksi 544-modda", field: "fuqarolik" }],
  },
];

export default async function DevLegal({ searchParams }: PageProps<"/dev/savol">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const page = String(sp.sahifa ?? "bosh");
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6">
      <p className="rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna ma&apos;lumot (faqat ishlab chiqish uchun).</p>
      {page === "bosh" && <LegalChat threadId={null} messages={[]} ask={demoAskLegal} createUpload={demoUpload} analyze={demoAnalyze} aiReady lawyersEnabled={false} />}
      {page === "hujjat" && <LegalChat threadId={null} messages={[]} ask={demoAskLegal} createUpload={demoUpload} analyze={demoAnalyze} aiReady lawyersEnabled={false} initialTab="hujjat" />}
      {page === "suhbat" && <LegalChat threadId="00000000-0000-0000-0000-000000000000" messages={MESSAGES} ask={demoAskLegal} aiReady lawyersEnabled />}
    </main>
  );
}
