import Link from "next/link";
import { Answer } from "@/components/tutor/chat";
import { CONFIDENCE_INFO, LEGAL_DISCLAIMER, showLawyerCta, type Confidence } from "@/lib/legal";

export type LegalChatSource = { id: number; ref: string; field: string | null };
export type LegalChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** foydalanuvchi xabari: yuklangan fayl nomi va turi (faylning o'zi saqlanmaydi) */
  doc?: { name: string; type: string; pages: number } | null;
  sources?: LegalChatSource[];
  confidence?: Confidence | null;
  needsLawyer?: boolean;
};

/** AI javobi: matn, manba moddalari, ishonch darajasi, ogohlantirish va kerak bo'lsa "Yuristga murojaat" */
export function AnswerCard({ m, lawyersEnabled }: { m: LegalChatMessage; lawyersEnabled: boolean }) {
  const conf = m.confidence ? CONFIDENCE_INFO[m.confidence] : null;
  const cta = showLawyerCta({ confidence: m.confidence ?? null, needs_lawyer: Boolean(m.needsLawyer) });
  return (
    <div className="card !p-4 text-[15px] leading-relaxed">
      {conf && <p className={`mb-3 inline-block rounded-md px-2 py-0.5 text-xs font-bold ${conf.cls}`}>{conf.label}</p>}
      <Answer text={m.content} />
      {m.sources && m.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
          <span className="text-xs font-bold text-mute">Manbalar:</span>
          {m.sources.map((s) => s.field ? (
            <Link key={s.id} href={`/app/sohalar/${s.field}/${s.id}`} className="rounded-md bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold hover:underline">📖 {s.ref}</Link>
          ) : <span key={s.id} className="rounded-md bg-line px-2 py-0.5 text-xs font-bold text-mute">📖 {s.ref}</span>)}
        </div>
      )}
      {cta && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft px-3 py-2.5">
          <p className="text-sm font-semibold">
            {m.needsLawyer ? "Vaziyatingiz tafsilotlarga bog'liq — yurist bilan maslahatlashgan ma'qul." : "Bazadagi moddalar bu savolga to'liq javob bermaydi — yurist bilan tekshiring."}
          </p>
          {lawyersEnabled
            ? <Link href="/app/yuristlar" className="btn-primary !px-3 !py-1.5 text-sm">⚖️ Yuristga murojaat</Link>
            : <span className="text-xs font-semibold text-mute">Yuristlar bo&apos;limi tez orada</span>}
        </div>
      )}
      <p className="mt-2 text-xs text-mute">ⓘ {LEGAL_DISCLAIMER}</p>
    </div>
  );
}
