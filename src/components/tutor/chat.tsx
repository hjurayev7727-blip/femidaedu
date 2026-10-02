"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { TutorMode } from "@/lib/ai";
import type { AiResult } from "@/lib/ai-server";
import { MODE_INFO } from "@/lib/tutor";
import type { TutorReply } from "@/lib/tutor-server";

export type ChatSource = { id: number; ref: string; field: string | null };
export type ChatMessage = { role: "user" | "assistant"; content: string; sources?: ChatSource[] };

const DISCLAIMER = "Bu yuridik maslahat emas — o'quv maqsadidagi tushuntirish.";

/** Javob matni: xatboshilar va "- " ro'yxatlar (Markdown'siz, xavfsiz) */
export function Answer({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter(Boolean);
        if (lines.length && lines.every((l) => /^\s*[-•*]\s+/.test(l))) {
          return <ul key={i} className="list-disc space-y-1 pl-5">{lines.map((l, k) => <li key={k}>{l.replace(/^\s*[-•*]\s+/, "").replace(/\*\*/g, "")}</li>)}</ul>;
        }
        return <p key={i}>{b.replace(/\*\*/g, "")}</p>;
      })}
    </div>
  );
}

export function TutorChat(props: {
  threadId: string | null;
  mode: TutorMode;
  messages: ChatMessage[];
  ask: (threadId: string | null, mode: unknown, question: unknown) => Promise<AiResult<TutorReply>>;
  aiReady: boolean;
  /** yangi suhbatda rejim tanlash */
  pickMode?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<TutorMode>(props.mode);
  const [messages, setMessages] = useState<ChatMessage[]>(props.messages);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  function send() {
    const q = text.trim();
    if (q.length < 3 || pending) return;
    setError(null);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setText("");
    start(async () => {
      const r = await props.ask(props.threadId, mode, q);
      if (!r.ok) {
        setError(r.message);
        setMessages((m) => m.slice(0, -1));
        setText(q);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", content: r.value.answer, sources: r.value.sources }]);
      if (!props.threadId) router.push(`/app/yordamchi/${r.value.threadId}`);
    });
  }

  const info = MODE_INFO[mode];
  return (
    <div className="space-y-4">
      {props.pickMode && (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Rejim">
          {(Object.keys(MODE_INFO) as TutorMode[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => setMode(k)}
              className={`rounded-xl border-2 p-3 text-left ${mode === k ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand/40"}`}>
              <b className="block">{MODE_INFO[k].icon} {MODE_INFO[k].title}</b>
              <span className="text-xs text-mute">{MODE_INFO[k].hint}</span>
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <ol className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "user" ? "flex justify-end" : ""}>
              {m.role === "user" ? (
                <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy-3 px-4 py-2.5 text-white">{m.content}</p>
              ) : (
                <div className="card !p-4 text-[15px] leading-relaxed">
                  <Answer text={m.content} />
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                      <span className="text-xs font-bold text-mute">Manbalar:</span>
                      {m.sources.map((s) => s.field ? (
                        <Link key={s.id} href={`/app/sohalar/${s.field}/${s.id}`} className="rounded-md bg-gold-soft px-2 py-0.5 text-xs font-bold text-gold hover:underline">📖 {s.ref}</Link>
                      ) : <span key={s.id} className="rounded-md bg-line px-2 py-0.5 text-xs font-bold text-mute">📖 {s.ref}</span>)}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-mute">ⓘ {DISCLAIMER}</p>
                </div>
              )}
            </li>
          ))}
          {pending && <li className="card !p-4 text-sm font-semibold text-mute" role="status">AI yordamchi o&apos;ylamoqda…</li>}
        </ol>
      )}
      <div ref={end} />

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="card space-y-3 !p-4">
        <label className="sr-only" htmlFor="tutor-q">Savol</label>
        <textarea id="tutor-q" value={text} onChange={(e) => setText(e.target.value)} rows={mode === "case" ? 5 : 3} maxLength={3000}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
          placeholder={messages.length ? "Savolni davom ettiring…" : info.placeholder}
          className="w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2.5 outline-none focus:border-brand" />
        {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
        {!props.aiReady && <p className="text-sm font-semibold text-amber">AI yordamchi hali ulanmagan.</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-mute">Javoblar bazadagi moddalar asosida · shaxsiy ish bo&apos;yicha yuristga murojaat qiling</p>
          <button className="btn-primary !py-2.5" disabled={pending || text.trim().length < 3 || !props.aiReady}>{pending ? "Yuborilmoqda…" : "Yuborish"}</button>
        </div>
      </form>
    </div>
  );
}
