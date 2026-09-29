"use client";
import Script from "next/script";
import { useEffect, useState } from "react";

type TelegramWebApp = { initData: string; ready(): void; expand(): void };
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

const TEXT: Record<string, string> = {
  outside: "Bu sahifa Telegram ichida ochiladi. Brauzerda kirish uchun:",
  signature: "Telegram ma'lumotini tasdiqlab bo'lmadi. Botni qayta ochib ko'ring.",
  server: "Serverda xatolik. Birozdan keyin urinib ko'ring.",
};

export function MiniAppLogin({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  // Telegram skripti gidratatsiyadan keyin yuklanadi (u <html> ga style qo'shadi — oldinroq yuklansa mismatch)
  const [sdk, setSdk] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    if (sdk === "loading") return;
    let cancelled = false;
    const fail = (e: string) => !cancelled && setError(e);
    (async () => {
      const app = window.Telegram?.WebApp;
      const initData = app?.initData;
      if (!app || !initData) return fail("outside");
      app.ready();
      app.expand();
      try {
        const r = await fetch("/api/auth/telegram-webapp", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData, keyin: next }),
        });
        const body = (await r.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
        if (body.ok && body.next) window.location.replace(body.next);
        else fail(body.error === "signature" ? "signature" : "server");
      } catch {
        fail("server");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [next, sdk]);

  const script = (
    <Script
      src="https://telegram.org/js/telegram-web-app.js"
      strategy="afterInteractive"
      onReady={() => setSdk("ready")}
      onError={() => setSdk("failed")}
    />
  );

  if (!error) {
    return (
      <>
        {script}
        <p role="status" className="mt-5 font-bold text-slate-300">
          Kirilmoqda…
        </p>
      </>
    );
  }
  return (
    <div className="mt-5 max-w-xs space-y-4">
      <p className="text-slate-300">{TEXT[error]}</p>
      {error === "outside" && (
        <a href={`/kirish?keyin=${encodeURIComponent(next)}`} className="btn-primary">
          Kirish sahifasi
        </a>
      )}
    </div>
  );
}
