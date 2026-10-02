"use client";
import { useState, type ReactNode } from "react";

/** "Savol berish" / "Hujjat tahlili" tablari */
export function SavolTabs({ ask, doc, initial = "ask" }: { ask: ReactNode; doc: ReactNode; initial?: "ask" | "doc" }) {
  const [tab, setTab] = useState(initial);
  const btn = (k: "ask" | "doc", label: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`rounded-lg px-4 py-2 text-sm font-bold ${tab === k ? "bg-card text-ink shadow-sm" : "text-mute hover:text-ink"}`}>
      {label}
    </button>
  );
  return (
    <div className="space-y-3">
      <div role="tablist" aria-label="Savol turi" className="inline-flex gap-1 rounded-xl bg-line/60 p-1">
        {btn("ask", "💬 Savol berish")}
        {btn("doc", "📄 Hujjat tahlili")}
      </div>
      <div role="tabpanel">{tab === "ask" ? ask : doc}</div>
    </div>
  );
}
