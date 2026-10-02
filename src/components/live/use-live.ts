"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { POLL_MS, secondsLeft, type LiveState, type LiveStateResult } from "@/lib/live";

/** Holatni so'rab turadi (polling) va taymerni server vaqtiga moslab hisoblaydi */
export function useLive(url: string | null, initial: LiveState) {
  const [state, setState] = useState<LiveState>(initial);
  const [lost, setLost] = useState<string | null>(null);
  const offset = useRef(0);
  const [left, setLeft] = useState(0);

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const r = await fetch(url, { cache: "no-store" });
      const s = (await r.json()) as LiveStateResult;
      if (!s.ok) return setLost(s.reason);
      offset.current = new Date(s.now).getTime() - Date.now();
      setLost(null);
      setState(s);
    } catch {
      // tarmoq uzilishi — keyingi so'rovda qayta urinamiz
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [url, refresh]);

  useEffect(() => {
    offset.current = new Date(initial.now).getTime() - Date.now();
  }, [initial.now]);

  useEffect(() => {
    const tick = () => setLeft(secondsLeft(state.ends_at, offset.current, Date.now()));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [state.ends_at]);

  return { state, left, lost, refresh };
}
