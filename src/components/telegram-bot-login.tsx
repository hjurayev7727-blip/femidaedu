"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Phase = { kind: "idle" } | { kind: "waiting"; link: string } | { kind: "error"; text: string };

const POLL_MS = 2000;
const GIVE_UP_MS = 10 * 60 * 1000;

const post = (body: object) =>
  fetch("/api/auth/telegram-bot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(
    (r) => r.json() as Promise<{ ok: boolean; link?: string; next?: string; state?: string }>,
  );

/** Telegram orqali kirish: bot ochiladi, foydalanuvchi "Tasdiqlash" ni bosadi, sayt o'zi kiradi. */
export function TelegramBotLogin({ next }: { next: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  function poll(startedAt: number) {
    timer.current = setTimeout(async () => {
      try {
        const r = await post({ action: "check", keyin: next });
        if (r.ok && r.next) {
          router.replace(r.next);
          router.refresh();
          return;
        }
        if (r.state === "expired" || Date.now() - startedAt > GIVE_UP_MS) {
          setPhase({ kind: "error", text: "Kirish havolasining muddati o'tdi. Qaytadan bosing." });
          return;
        }
        if (r.state === "error") {
          setPhase({ kind: "error", text: "Serverda xatolik. Qaytadan urinib ko'ring." });
          return;
        }
      } catch {
        // tarmoq uzilishi — keyingi urinishda davom etamiz
      }
      poll(startedAt);
    }, POLL_MS);
  }

  async function start() {
    // Popup blokerlari: oynani bosish paytida ochib, manzilni keyin beramiz
    const win = window.open("", "_blank");
    try {
      const r = await post({ action: "start" });
      if (!r.ok || !r.link) throw new Error();
      if (win) win.location.href = r.link;
      setPhase({ kind: "waiting", link: r.link });
      poll(Date.now());
    } catch {
      win?.close();
      setPhase({ kind: "error", text: "Kirishni boshlab bo'lmadi. Qaytadan urinib ko'ring." });
    }
  }

  if (phase.kind === "waiting") {
    return (
      <div className="space-y-3 rounded-2xl bg-cyan-soft px-4 py-4 text-center">
        <p className="font-extrabold">Telegram&apos;da «✅ Tasdiqlash» ni bosing</p>
        <p className="text-sm text-mute">Tasdiqlaganingizdan so&apos;ng bu sahifa o&apos;zi kiradi.</p>
        <a href={phase.link} target="_blank" rel="noopener" className="btn-primary w-full">
          Telegram&apos;ni ochish
        </a>
        <p className="flex items-center justify-center gap-2 text-xs text-mute">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-cyan" aria-hidden /> Tasdiq kutilmoqda…
        </p>
      </div>
    );
  }

  return (
    <div>
      <button type="button" onClick={start} className="btn w-full whitespace-nowrap bg-[#2AABEE] text-white hover:bg-[#229ED9]">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
          <path d="M9.78 15.27 9.6 19.5c.4 0 .57-.17.78-.38l1.87-1.79 3.88 2.84c.71.39 1.22.19 1.41-.66l2.55-11.96c.24-1.06-.4-1.48-1.09-1.22L4.13 10.08c-1.03.4-1.02.98-.18 1.24l3.83 1.2 8.9-5.61c.42-.27.8-.12.49.15" />
        </svg>
        Telegram orqali kirish
      </button>
      {phase.kind === "error" && <p className="mt-2 text-center text-sm text-no">{phase.text}</p>}
    </div>
  );
}
