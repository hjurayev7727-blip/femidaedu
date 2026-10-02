"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_AFTER_MS, IDLE_POLL_MS, lastId, mergeMessages, POLL_MS, type ChatMsg, type ChatOffer, type ChatPoll } from "@/lib/chat";

/** Yozishmani so'rab turadi: faqat yangi xabarlar (after), yashirin tabda to'xtaydi, harakatsizlikda siyraklashadi */
export function useChat(conv: string, initial: { messages: ChatMsg[]; offers: ChatOffer[]; otherRead: number; paid: boolean }) {
  const [messages, setMessages] = useState(initial.messages);
  const [offers, setOffers] = useState(initial.offers);
  const [otherRead, setOtherRead] = useState(initial.otherRead);
  const [paid, setPaid] = useState(initial.paid);
  const [lost, setLost] = useState(false);
  const after = useRef(lastId(initial.messages));
  const activeAt = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/suhbat/${conv}?after=${after.current}`, { cache: "no-store" });
      const s = (await r.json()) as ChatPoll;
      if (!s.ok) return setLost(true);
      setLost(false);
      if (s.messages.length) {
        after.current = Math.max(after.current, lastId(s.messages));
        setMessages((m) => mergeMessages(m, s.messages));
      }
      setOffers(s.offers);
      setOtherRead(s.other_read);
      setPaid(s.paid);
    } catch {
      // tarmoq uzilishi — keyingi so'rovda qayta urinamiz
    }
  }, [conv]);

  useEffect(() => {
    activeAt.current = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (!document.hidden) await refresh();
      const idle = Date.now() - activeAt.current > IDLE_AFTER_MS;
      timer = setTimeout(loop, idle ? IDLE_POLL_MS : POLL_MS);
    };
    timer = setTimeout(loop, POLL_MS);
    const wake = () => {
      activeAt.current = Date.now();
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [refresh]);

  const addLocal = useCallback((body: string) => {
    activeAt.current = Date.now();
    setMessages((m) => [...m, { id: -Date.now(), mine: true, kind: "text", body, offer_id: null, created_at: new Date().toISOString() }]);
  }, []);
  const dropLocal = useCallback((body: string) => setMessages((m) => m.filter((x) => !(x.id < 0 && x.body === body))), []);

  return { messages, offers, otherRead, paid, lost, refresh, addLocal, dropLocal };
}
