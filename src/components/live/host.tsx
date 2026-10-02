"use client";
import { useTransition } from "react";
import type { LiveState } from "@/lib/live";
import type { ChoicePayload } from "@/lib/questions";
import { Leaderboard } from "./leaderboard";
import { useLive } from "./use-live";

const LETTERS = "ABCDEFGH";

/** O'qituvchi (host) ekrani — proyektorga chiqarish uchun katta shrift */
export function LiveHost(props: {
  roomId: string;
  initial: LiveState;
  qrSvg: string;
  joinUrl: string;
  telegramUrl: string | null;
  control: (roomId: string, action: "next" | "reveal" | "finish") => Promise<boolean>;
  editorHref: string;
  demo?: boolean;
}) {
  const { state: s, left, refresh } = useLive(props.demo ? null : `/api/jonli/${props.roomId}?host=1`, props.initial);
  const [pending, start] = useTransition();
  const act = (a: "next" | "reveal" | "finish") => start(async () => {
    await props.control(props.roomId, a);
    await refresh();
  });
  const item = s.item;
  const options = item && "options" in item.payload ? (item.payload as ChoicePayload).options : null;
  const correctIndex = s.answer && "index" in s.answer ? s.answer.index : null;
  const dist = s.distribution ?? {};
  const maxDist = Math.max(1, ...Object.values(dist));
  const last = s.pos + 1 >= s.total;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{s.title}</h1>
        <div className="flex items-center gap-3 text-sm font-bold">
          <span className="rounded-lg bg-navy px-3 py-1.5 font-mono tracking-widest text-white">PIN {s.pin}</span>
          <span className="text-mute">👥 {s.players}/{s.max_players}</span>
        </div>
      </div>

      {s.status === "lobby" && (
        <div className="grid items-start gap-5 md:grid-cols-[auto_1fr]">
          <div className="card space-y-3 text-center">
            <div className="mx-auto w-56 rounded-xl bg-white p-3" dangerouslySetInnerHTML={{ __html: props.qrSvg }} aria-label="QR kod" role="img" />
            <p className="text-xs font-bold uppercase tracking-widest text-mute">PIN</p>
            <p className="font-mono text-5xl font-bold tracking-[.2em]">{s.pin}</p>
            <p className="break-all text-sm text-mute">{props.joinUrl.replace(/^https?:\/\//, "")}</p>
            {props.telegramUrl && <p className="break-all text-xs text-mute">Telegram: {props.telegramUrl.replace(/^https:\/\//, "")}</p>}
          </div>
          <div className="card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Ishtirokchilar ({s.players})</h2>
              <button type="button" onClick={() => act("next")} disabled={pending || s.players === 0} className="btn-gold">▶ Boshlash</button>
            </div>
            {s.names && s.names.length ? (
              <ul className="flex flex-wrap gap-2">{s.names.map((n, i) => <li key={`${n}-${i}`} className="rounded-full bg-brand-soft px-3 py-1.5 text-sm font-bold text-brand-2">{n}</li>)}</ul>
            ) : <p className="text-mute">Ishtirokchilarni kutyapmiz… QR kodni skanerlang yoki PIN bilan kiring.</p>}
          </div>
        </div>
      )}

      {(s.status === "question" || s.status === "reveal") && item && (
        <div className="card space-y-5">
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-mute">Savol {s.pos + 1} / {s.total}</span>
            {s.status === "question"
              ? <span className={`rounded-xl px-4 py-2 font-mono text-3xl tabular-nums ${left <= 5 ? "bg-no-soft text-no" : "bg-brand-soft text-brand-2"}`} role="timer">{left}</span>
              : <span className="rounded-lg bg-ok-soft px-3 py-1.5 text-ok">Javoblar</span>}
          </div>
          {item.context && <p className="rounded-r-xl border-l-4 border-amber bg-amber-soft px-4 py-3 text-lg">{item.context}</p>}
          <h2 className="text-2xl font-bold leading-snug md:text-3xl">{item.stem}</h2>
          {options && (
            <ul className="grid gap-3 md:grid-cols-2">
              {options.map((o, i) => {
                const right = s.status === "reveal" && correctIndex === i;
                const n = dist[String(i)] ?? 0;
                return (
                  <li key={i} className={`relative overflow-hidden rounded-xl border-2 px-4 py-3 text-lg font-semibold ${right ? "border-ok bg-ok-soft" : "border-line"}`}>
                    {s.status === "reveal" && <span className="absolute inset-y-0 left-0 bg-brand/10" style={{ width: `${(100 * n) / maxDist}%` }} aria-hidden />}
                    <span className="relative flex items-center justify-between gap-3">
                      <span><b>{LETTERS[i]})</b> {o}</span>
                      {s.status === "reveal" && <span className="font-mono text-base">{n}{right ? " ✓" : ""}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {s.status === "reveal" && s.explanation && <p className="rounded-r-xl border-l-4 border-brand bg-brand-soft px-4 py-3">{s.explanation}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-bold text-mute">Javob berdi: {s.answered}/{s.players}</span>
            {s.status === "question"
              ? <button type="button" onClick={() => act("reveal")} disabled={pending} className="btn-ghost">Javobni ko&apos;rsatish</button>
              : <button type="button" onClick={() => act("next")} disabled={pending} className="btn-gold">{last ? "🏁 Yakunlash" : "Keyingi savol →"}</button>}
          </div>
        </div>
      )}

      {s.status === "reveal" && s.top && (
        <div className="card"><h2 className="mb-3 text-xl font-bold">Top-5</h2><Leaderboard top={s.top} large /></div>
      )}

      {s.status === "finished" && (
        <div className="space-y-4">
          <div className="bg-hero rounded-[22px] p-6 text-center text-white">
            <p className="text-5xl" aria-hidden>🏆</p>
            <p className="mt-2 font-display text-3xl font-bold">{s.top?.[0]?.name ?? "—"}</p>
            <p className="text-slate-300">g&apos;olib · {s.top?.[0]?.score ?? 0} ball</p>
          </div>
          <div className="card"><h2 className="mb-3 text-xl font-bold">Yakuniy natijalar ({s.players})</h2><Leaderboard top={s.top ?? []} large /></div>
          <a href={props.editorHref} className="btn-ghost">← Testga qaytish</a>
        </div>
      )}

      {s.status !== "finished" && (
        <div className="flex justify-end">
          <button type="button" onClick={() => confirm("Viktorina yakunlansinmi?") && act("finish")} disabled={pending} className="rounded-lg px-3 py-2 text-sm font-bold text-no hover:bg-no-soft">Yakunlash</button>
        </div>
      )}
    </div>
  );
}
