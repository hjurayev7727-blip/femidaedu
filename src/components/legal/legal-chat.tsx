"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AiResult } from "@/lib/ai-server";
import { CONFIDENCE_INFO, LEGAL_DISCLAIMER, showLawyerCta, type Confidence } from "@/lib/legal";
import type { LegalReply } from "@/lib/legal-server";
import { Answer, type ChatSource } from "@/components/tutor/chat";

export type LegalMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  confidence?: Confidence | null;
  needsLawyer?: boolean;
  doc?: { type: "pdf" | "image"; pages: number; name: string } | null;
};

/** AI javobi kartasi: matn, ishonch darajasi, manbalar, ogohlantirish, kerak bo'lsa "Yuristga murojaat" */
export function LegalAnswerCard({ m, lawyersEnabled }: { m: LegalMessage; lawyersEnabled: boolean }) {
  const conf = m.confidence ? CONFIDENCE_INFO[m.confidence] : null;
  const cta = showLawyerCta({ confidence: m.confidence ?? null, needs_lawyer: Boolean(m.needsLawyer) });
  return (
    <div className="card !p-4 text-[15px] leading-relaxed">
      {conf && <span className={`mb-2 inline-block rounded-md px-2 py-0.5 text-xs font-bold ${conf.cls}`}>{conf.label}</span>}
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
        <div className="mt-3 rounded-xl bg-brand-soft px-3 py-2.5 text-sm">
          <b>Bu holatda yurist bilan maslahatlashgan ma&apos;qul.</b>
          {lawyersEnabled && m.id ? (
            <Link href={`/app/yuristlar/ariza?from=${m.id}`} className="btn-primary ml-2 !px-3 !py-1.5 !text-sm">⚖️ Yuristga murojaat</Link>
          ) : (
            <span className="block text-mute">Yuristlar bo&apos;limi tez orada ochiladi.</span>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-mute">ⓘ {LEGAL_DISCLAIMER}</p>
    </div>
  );
}

export function UserBubble({ m }: { m: LegalMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-3 px-4 py-2.5 text-white">
        {m.doc && <p className="mb-1 text-xs font-bold text-gold-2">📄 {m.doc.name} · {m.doc.type === "pdf" ? `${m.doc.pages} sahifa` : "rasm"}</p>}
        <p className="whitespace-pre-wrap">{m.content}</p>
      </div>
    </div>
  );
}

export function LegalChat(props: {
  threadId: string | null;
  messages: LegalMessage[];
  ask: (threadId: string | null, question: unknown) => Promise<AiResult<LegalReply>>;
  aiReady: boolean;
  lawyersEnabled: boolean;
  /** hujjat suhbati — davom ettirib bo'lmaydi */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<LegalMessage[]>(props.messages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  function send() {
    const q = text.trim();
    if (q.length < 5 || pending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setText("");
    start(async () => {
      const r = await props.ask(props.threadId, q);
      if (!r.ok) {
        setError(r.message);
        setMessages((m) => m.slice(0, -1));
        setText(q);
        return;
      }
      if (!props.threadId) {
        router.push(`/app/savol/${r.value.threadId}`);
        return;
      }
      // id (xabar raqami) kerak bo'lgani uchun sahifa yangilanadi; vaqtincha javob ko'rsatiladi
      setMessages((m) => [...m, { role: "assistant", content: r.value.answer, sources: r.value.sources, confidence: r.value.confidence, needsLawyer: r.value.needsLawyer }]);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {messages.length > 0 && (
        <ol className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li key={m.id ?? `t${i}`}>{m.role === "user" ? <UserBubble m={m} /> : <LegalAnswerCard m={m} lawyersEnabled={props.lawyersEnabled} />}</li>
          ))}
          {pending && <li className="card !p-4 text-sm font-semibold text-mute" role="status">Qonun moddalari qidirilmoqda va javob tayyorlanmoqda…</li>}
        </ol>
      )}
      <div ref={end} />

      {!props.readOnly && (
        <form onSubmit={(e) => { e.preventDefault(); send(); }} className="card space-y-3 !p-4">
          <label className="sr-only" htmlFor="legal-q">Savol</label>
          <textarea id="legal-q" value={text} onChange={(e) => setText(e.target.value)} rows={messages.length ? 3 : 5} maxLength={3000}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
            placeholder={messages.length ? "Aniqlashtiruvchi savol…" : "Masalan: Ish beruvchi 2 oydan beri ish haqini bermayapti. Nima qilishim mumkin va qayerga murojaat qilaman?"}
            className="w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2.5 outline-none focus:border-brand" />
          {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
          {!props.aiReady && <p className="text-sm font-semibold text-amber">AI yordamchi hali ulanmagan.</p>}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-mute">Javob amaldagi qonun moddalari asosida beriladi</p>
            <button className="btn-primary !py-2.5" disabled={pending || text.trim().length < 5 || !props.aiReady}>{pending ? "Yuborilmoqda…" : "Savol berish"}</button>
          </div>
        </form>
      )}
    </div>
  );
}
