"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import type { AiResult } from "@/lib/ai-server";
import type { ChatMsg, ChatOffer } from "@/lib/chat";
import { fmtUz } from "@/lib/dates";
import { fmtSum } from "@/lib/lawyers";
import { useChat } from "./use-chat";

const OFFER_STATUS: Record<ChatOffer["status"], string> = { pending: "Kutilmoqda", accepted: "Qabul qilingan", withdrawn: "Bekor qilingan", declined: "Rad etilgan" };

function OfferCard({ o, role, onDecline, payReady }: { o: ChatOffer; role: "client" | "lawyer"; onDecline: (id: number) => void; payReady: boolean }) {
  return (
    <div className="rounded-xl border-2 border-gold/40 bg-gold-soft/40 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-gold">Narx taklifi · {OFFER_STATUS[o.status]}</p>
      <p className="mt-1 text-xl font-extrabold">{fmtSum(o.price_uzs)}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{o.note}</p>
      {role === "client" && o.status === "pending" && (
        <div className="mt-2 flex flex-wrap gap-2">
          {payReady
            ? <a href={`/app/buyurtmalar/yangi?taklif=${o.id}`} className="btn-primary !px-3 !py-1.5 !text-sm">Qabul qilish va to&apos;lash</a>
            : <span className="text-xs font-semibold text-mute">Platforma orqali to&apos;lov tez orada ishga tushadi.</span>}
          <button type="button" onClick={() => onDecline(o.id)} className="btn-ghost !px-3 !py-1.5 !text-sm">Rad etish</button>
        </div>
      )}
    </div>
  );
}

export function ChatRoom(props: {
  conv: string;
  role: "client" | "lawyer";
  otherName: string;
  initial: { messages: ChatMsg[]; offers: ChatOffer[]; otherRead: number; paid: boolean };
  send: (conv: unknown, body: unknown) => Promise<AiResult<{ id: number; masked: boolean }>>;
  offer: (conv: unknown, price: unknown, note: unknown) => Promise<AiResult<number>>;
  decline: (offer: unknown) => Promise<boolean>;
  blocked: boolean;
  payReady: boolean;
}) {
  const chat = useChat(props.conv, props.initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [pending, run] = useTransition();
  const end = useRef<HTMLDivElement>(null);
  const offersById = new Map(chat.offers.map((o) => [o.id, o]));

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.messages.length]);

  function send() {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    setNote(null);
    setText("");
    chat.addLocal(body);
    run(async () => {
      const r = await props.send(props.conv, body);
      chat.dropLocal(body);
      if (!r.ok) {
        setError(r.message);
        setText(body);
        return;
      }
      if (r.value.masked) setNote("Telefon, Telegram va email to'lovdan keyin ko'rinadi — xabardagi kontaktlar yashirildi.");
      await chat.refresh();
    });
  }

  function sendOffer(form: FormData) {
    setError(null);
    run(async () => {
      const r = await props.offer(props.conv, form.get("price"), form.get("note"));
      if (!r.ok) return setError(r.message);
      setOfferOpen(false);
      await chat.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {chat.lost && <p role="alert" className="rounded-xl bg-no-soft px-4 py-2 text-sm font-semibold text-no">Suhbatga ulanib bo&apos;lmadi.</p>}
      <ol className="card max-h-[60vh] space-y-2 overflow-y-auto !p-3" aria-live="polite">
        {chat.messages.map((m) => (
          <li key={m.id} className={m.kind === "system" ? "text-center" : m.mine ? "flex justify-end" : "flex"}>
            {m.kind === "system" ? (
              <span className="inline-block rounded-lg bg-line/60 px-3 py-1 text-xs font-semibold text-mute">{m.body}</span>
            ) : m.kind === "offer" && m.offer_id && offersById.get(m.offer_id) ? (
              <div className="w-full max-w-sm">
                <OfferCard o={offersById.get(m.offer_id)!} role={props.role} payReady={props.payReady}
                  onDecline={(id) => run(async () => { await props.decline(id); await chat.refresh(); })} />
              </div>
            ) : (
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${m.mine ? "rounded-br-md bg-navy-3 text-white" : "rounded-bl-md bg-bg"}`}>
                <p className="whitespace-pre-wrap text-[15px]">{m.body}</p>
                <p className={`mt-0.5 text-right text-[11px] ${m.mine ? "text-slate-300" : "text-mute"}`}>
                  {m.id < 0 ? "yuborilmoqda…" : fmtUz(m.created_at, { time: true, short: true })}
                  {m.mine && m.id > 0 && (m.id <= chat.otherRead ? " · o'qildi" : "")}
                </p>
              </div>
            )}
          </li>
        ))}
        <div ref={end} />
      </ol>

      {props.blocked ? (
        <p className="card text-center text-sm font-semibold text-mute">Yozishma to&apos;xtatilgan.</p>
      ) : (
        <>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="card space-y-2 !p-3">
            <label className="sr-only" htmlFor="chat-input">Xabar</label>
            <textarea id="chat-input" value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder={`${props.otherName}ga xabar…`}
              className="w-full resize-y rounded-xl border-2 border-line bg-card px-3 py-2 outline-none focus:border-brand" />
            {note && <p role="status" className="text-xs font-semibold text-amber">{note}</p>}
            {error && <p role="alert" className="text-sm font-semibold text-no">{error}</p>}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-mute">{chat.paid ? "To'lov qilingan — kontaktlar ochiq." : "Kontaktlar to'lovdan keyin ochiladi."}</p>
              <div className="flex gap-2">
                {props.role === "lawyer" && <button type="button" onClick={() => setOfferOpen((v) => !v)} className="btn-ghost !py-2">💼 Narx taklifi</button>}
                <button className="btn-primary !py-2" disabled={!text.trim() || pending}>Yuborish</button>
              </div>
            </div>
          </form>
          {offerOpen && (
            <form action={sendOffer} className="card grid gap-2 !p-3 sm:grid-cols-[160px_1fr_auto]">
              <input name="price" type="number" min={10000} step={1000} required placeholder="Narx, so'm" className="rounded-xl border-2 border-line bg-card px-3 py-2" />
              <input name="note" required minLength={5} maxLength={1000} placeholder="Nima ish qilinadi, qancha muddatda" className="rounded-xl border-2 border-line bg-card px-3 py-2" />
              <button className="btn-primary !py-2" disabled={pending}>Yuborish</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
