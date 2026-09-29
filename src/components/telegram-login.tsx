"use client";
import { useEffect, useRef } from "react";

/** Server ham shu nomni tekshiradi (api/auth/telegram/route.ts) */
export const STATE_COOKIE = "tg_state";

/**
 * Rasmiy Telegram Login Widget (redirect rejimi). Bot uchun BotFather'da /setdomain
 * bilan sayt domeni ko'rsatilgan bo'lishi shart — localhost'da widget ishlamaydi.
 */
export function TelegramLogin({ bot, authUrl }: { bot: string; authUrl: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // Login CSRF himoyasi: tasodifiy state cookie'da va qaytish URL'ida — server ikkalasini solishtiradi
    const state = crypto.randomUUID().replace(/-/g, "");
    document.cookie = `${STATE_COOKIE}=${state}; path=/api/auth/telegram; max-age=900; samesite=lax${location.protocol === "https:" ? "; secure" : ""}`;
    const url = new URL(authUrl, location.origin);
    url.searchParams.set("s", state);
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.setAttribute("data-telegram-login", bot);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "14");
    s.setAttribute("data-userpic", "false");
    s.setAttribute("data-lang", "uz");
    s.setAttribute("data-auth-url", url.toString());
    s.setAttribute("data-request-access", "write"); // bot keyinchalik eslatma yubora olishi uchun
    host.replaceChildren(s);
    return () => host.replaceChildren();
  }, [bot, authUrl]);

  return <div ref={ref} className="flex min-h-[46px] justify-center" />;
}
