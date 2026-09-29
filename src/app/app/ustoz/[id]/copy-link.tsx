"use client";
import { useState } from "react";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input readOnly value={url} aria-label="Taklif havolasi" onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-xl border-2 border-line bg-bg px-3 py-2 font-mono text-sm" />
      <button
        type="button"
        className="btn-primary px-4! py-2! text-sm!"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Nusxalandi ✓" : "Nusxalash"}
      </button>
      <a
        className="btn-ghost px-4! py-2! text-sm!"
        target="_blank"
        rel="noreferrer"
        href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent("A+ Huquq guruhimizga qo'shiling:")}`}
      >
        Telegram&apos;da ulashish
      </a>
    </div>
  );
}
