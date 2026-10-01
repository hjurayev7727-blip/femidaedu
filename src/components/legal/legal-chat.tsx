"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AiResult } from "@/lib/ai-server";
import { DOC_EXT, MAX_DOC_BYTES, type DocMime } from "@/lib/legal";
import type { LegalReply } from "@/lib/legal-server";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { AnswerCard, type LegalChatMessage } from "./answer-card";

type Actions = {
  ask: (threadId: string | null, question: unknown) => Promise<AiResult<LegalReply>>;
  createUpload?: (file: unknown) => Promise<AiResult<{ path: string; token: string }>>;
  analyze?: (input: unknown) => Promise<AiResult<LegalReply>>;
};

const BUCKET = "legal-uploads";
const ACCEPT = Object.keys(DOC_EXT).join(",");

/** "Savol bering": savol yozish yoki hujjat yuklash (yangi suhbat), keyin suhbatni davom ettirish */
export function LegalChat(props: Actions & {
  threadId: string | null;
  messages: LegalChatMessage[];
  aiReady: boolean;
  lawyersEnabled: boolean;
  /** yangi suhbatda: "Savol" yoki "Hujjat" yorlig'i */
  initialTab?: "savol" | "hujjat";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"savol" | "hujjat">(props.initialTab ?? "savol");
  const [messages, setMessages] = useState<LegalChatMessage[]>(props.messages);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const isNew = !props.threadId;
  const docTab = isNew && tab === "hujjat" && Boolean(props.createUpload && props.analyze);

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  function done(r: AiResult<LegalReply>, restore: () => void) {
    setStage(null);
    if (!r.ok) {
      setError(r.message);
      setMessages((m) => m.slice(0, -1));
      restore();
      return;
    }
    setMessages((m) => [...m, {
      role: "assistant", content: r.value.answer, sources: r.value.sources, confidence: r.value.confidence, needsLawyer: r.value.needsLawyer,
    }]);
    if (isNew) router.push(`/app/savol/${r.value.threadId}`);
  }

  function sendQuestion() {
    const q = text.trim();
    if (q.length < 3 || pending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setText("");
    start(async () => done(await props.ask(props.threadId, q), () => setText(q)));
  }

  function pickFile(f: File | null) {
    setError(null);
    if (!f) return setFile(null);
    if (!(f.type in DOC_EXT)) return setError("Faqat rasm (JPG, PNG, WEBP) yoki PDF");
    if (f.size > MAX_DOC_BYTES) return setError("Fayl 10 MB dan katta");
    setFile(f);
  }

  function sendDocument() {
    if (!file || pending || !props.createUpload || !props.analyze) return;
    const q = text.trim();
    const f = file;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q || "Hujjatni tahlil qiling", doc: { name: f.name, type: "", pages: 0 } }]);
    start(async () => {
      setStage("Yuklanmoqda…");
      const up = await props.createUpload!({ mime: f.type as DocMime, size: f.size, name: f.name });
      if (!up.ok) return done(up, () => undefined);
      const { error: upErr } = await createSupabaseBrowser().storage.from(BUCKET).uploadToSignedUrl(up.value.path, up.value.token, f, { contentType: f.type });
      if (upErr) return done({ ok: false, message: "Faylni yuklab bo'lmadi. Internetni tekshirib, qayta urinib ko'ring." }, () => undefined);
      setStage("Hujjat tahlil qilinmoqda — bu 1 daqiqagacha davom etishi mumkin…");
      done(await props.analyze!({ path: up.value.path, question: q, name: f.name }), () => undefined);
    });
  }

  return (
    <div className="space-y-4">
      {isNew && props.createUpload && (
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Savol turi">
          {([["savol", "💬 Savol yozish", "Vaziyatingizni oddiy so'zlar bilan yozing"], ["hujjat", "📄 Hujjat tahlili", "Shartnoma yoki ariza: rasm yoki PDF"]] as const).map(([k, title, hint]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setError(null); }}
              className={`rounded-xl border-2 p-3 text-left ${tab === k ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/40"}`}>
              <b className="block">{title}</b>
              <span className="text-xs text-mute">{hint}</span>
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <ol className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <div className="max-w-[85%] space-y-1.5 rounded-2xl rounded-br-md bg-navy-3 px-4 py-2.5 text-white">
                  {m.doc && <p className="text-xs font-bold text-gold-2">📄 {m.doc.name}{m.doc.type ? ` · ${m.doc.type}` : ""}{m.doc.pages > 1 ? ` · ${m.doc.pages} bet` : ""}</p>}
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              ) : <AnswerCard m={m} lawyersEnabled={props.lawyersEnabled} />}
            </li>
          ))}
          {pending && <li className="card !p-4 text-sm font-semibold text-mute" role="status">{stage ?? "Javob tayyorlanmoqda…"}</li>}
        </ol>
      )}
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); if (docTab) sendDocument(); else sendQuestion(); }} className="card space-y-3 !p-4">
        {docTab && (
          <div>
            <input ref={fileInput} id="legal-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pickFile(e.target.files?.[0] ?? null)} />
            <label htmlFor="legal-file"
              className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-line px-4 py-6 text-center hover:border-brand/50">
              <span className="text-2xl" aria-hidden>📄</span>
              <b>{file ? file.name : "Faylni tanlang"}</b>
              <span className="text-xs text-mute">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · boshqasini tanlash uchun bosing` : "Rasm (JPG, PNG, WEBP) yoki PDF · 10 MB va 20 betgacha"}</span>
            </label>
          </div>
        )}
        <label className="sr-only" htmlFor="legal-q">{docTab ? "Hujjat bo'yicha savol" : "Savol"}</label>
        <textarea id="legal-q" value={text} onChange={(e) => setText(e.target.value)} rows={docTab ? 2 : 4} maxLength={docTab ? 2000 : 3000}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { if (docTab) sendDocument(); else sendQuestion(); } }}
          placeholder={docTab ? "Savolingiz (ixtiyoriy): masalan, bu ijara shartnomasini imzolasam bo'ladimi?"
            : messages.length ? "Savolni davom ettiring…" : "Masalan: Ish beruvchi 2 oylik maoshimni bermayapti. Qayerga murojaat qilsam bo'ladi?"}
          className="w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2.5 outline-none focus:border-brand" />
        {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
        {!props.aiReady && <p className="text-sm font-semibold text-amber">AI yordamchi hali ulanmagan.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-mute">
            {docTab ? "Fayl tahlildan keyin darhol o'chiriladi — faqat javob saqlanadi" : "Javob amaldagi qonun moddalari asosida, manba havolalari bilan"}
          </p>
          <button className="btn-primary !py-2.5" disabled={pending || !props.aiReady || (docTab ? !file : text.trim().length < 3)}>
            {pending ? "Yuborilmoqda…" : docTab ? "Tahlil qilish" : "Yuborish"}
          </button>
        </div>
      </form>
    </div>
  );
}
