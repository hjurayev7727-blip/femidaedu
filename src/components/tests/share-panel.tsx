"use client";
import { useState } from "react";

/** Havola, kod va Telegram orqali ulashish */
export function SharePanel({ code, web, telegram, title }: { code: string; web: string; telegram: string | null; title: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(telegram ?? web)}&text=${encodeURIComponent(`«${title}» testini ishlang — kod ${code}`)}`;

  return (
    <section className="card space-y-4">
      <h2 className="text-xl font-bold">Ulashish</h2>
      <div className="flex flex-wrap items-center gap-4">
        <div className="rounded-2xl bg-navy px-5 py-3 text-center text-white">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-gold-2">Kod</p>
          <p className="font-mono text-3xl font-bold tracking-[.25em]">{code}</p>
        </div>
        <button type="button" onClick={() => copy("code", code)} className="btn-ghost !py-2.5">{copied === "code" ? "Nusxalandi ✓" : "Kodni nusxalash"}</button>
      </div>
      <div className="space-y-2">
        {[["web", "Havola", web], ...(telegram ? [["tg", "Telegram Mini App", telegram]] : [])].map(([k, label, url]) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-sm font-bold text-mute">{label}</span>
            <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-lg border-2 border-line bg-bg px-3 py-2 font-mono text-sm" />
            <button type="button" onClick={() => copy(k, url)} className="shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-brand-2 hover:bg-brand-soft">
              {copied === k ? "✓" : "Nusxa"}
            </button>
          </div>
        ))}
      </div>
      <a href={shareUrl} target="_blank" rel="noopener" className="btn-primary">✈️ Telegram&apos;da yuborish</a>
    </section>
  );
}
