// Faqat ishlab chiqish uchun: jonli viktorina ekranlari namuna holatlar bilan (Supabase'siz). Production'da mavjud emas.
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { LiveHost } from "@/components/live/host";
import { JoinForm } from "@/components/live/join-form";
import { LivePlayer } from "@/components/live/player";
import type { LiveState, LiveStatus } from "@/lib/live";
import { demoAnswer, demoControl, demoJoin } from "./actions";

const TOP = [
  { name: "Ism Familiya", score: 1840, correct: 2 }, { name: "Mehmon Ism", score: 1520, correct: 2 },
  { name: "Ism Familiya 2", score: 910, correct: 1 }, { name: "Ism 4", score: 640, correct: 1 }, { name: "Ism 5", score: 0, correct: 0 },
];

function sample(status: LiveStatus, nowMs: number): LiveState {
  const q = status === "question" || status === "reveal";
  return {
    ok: true, status, title: "Mehnat shartnomasi — 1-bob", pin: "482913", pos: q ? 1 : status === "finished" ? 2 : -1, total: 3, seconds: 20,
    ends_at: status === "question" ? new Date(nowMs + 14_000).toISOString() : null, now: new Date(nowMs).toISOString(),
    max_players: 30, players: 5, answered: q ? 4 : 0,
    item: q ? { id: 2, type: "single", stem: "Namuna: sinov muddati necha oydan oshmaydi?", context: null, payload: { options: ["1 oy", "3 oy", "6 oy", "12 oy"] }, difficulty: 2 } : null,
    answer: status === "reveal" ? { index: 1 } : null,
    explanation: status === "reveal" ? "Namuna izoh: 3 oydan oshmaydi." : null,
    names: status === "lobby" ? TOP.map((t) => t.name) : null,
    top: status === "reveal" || status === "finished" ? TOP : null,
    distribution: status === "reveal" ? { "0": 1, "1": 3, "3": 1 } : null,
    me: { name: "Mehmon Ism", score: 1520, correct: 2, rank: 2, answered: false, last: status === "reveal" ? { correct: true, points: 820 } : null },
  };
}

export default async function DevLive({ searchParams }: PageProps<"/dev/jonli">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const who = sp.kim === "oquvchi" ? "oquvchi" : sp.kim === "kirish" ? "kirish" : "host";
  const status = (["lobby", "question", "reveal", "finished"].includes(String(sp.holat)) ? sp.holat : "lobby") as LiveStatus;
  // eslint-disable-next-line react-hooks/purity -- dev namunasi
  const s = sample(status, Date.now());
  const qrSvg = await QRCode.toString("https://t.me/FemidaEduBot?startapp=j_482913", { type: "svg", margin: 1, color: { dark: "#0e2340", light: "#ffffff" } });
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
      <p className="mb-4 rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold text-amber">Namuna holat (faqat ishlab chiqish uchun).</p>
      {who === "kirish" && <JoinForm action={demoJoin} pin="482913" signedIn={false} name="" />}
      {who === "kirish" ? null : who === "host"
        ? <LiveHost roomId="demo" initial={s} qrSvg={qrSvg} joinUrl="https://femidaedu.uz/jonli?pin=482913" telegramUrl="https://t.me/FemidaEduBot?startapp=j_482913" control={demoControl} editorHref="/dev/testlar?sahifa=tahrir" demo />
        : <LivePlayer roomId="demo" initial={s} answer={demoAnswer} demo />}
    </main>
  );
}
