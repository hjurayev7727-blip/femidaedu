import type { LiveTop } from "@/lib/live";

const MEDAL = ["🥇", "🥈", "🥉"];

export function Leaderboard({ top, highlight, large }: { top: LiveTop[]; highlight?: string; large?: boolean }) {
  if (!top.length) return <p className="text-center text-sm text-mute">Hali hech kim ball olmadi.</p>;
  return (
    <ol className="space-y-2">
      {top.map((t, i) => (
        <li key={`${t.name}-${i}`} className={`flex items-center justify-between gap-3 rounded-xl px-4 ${large ? "py-3 text-lg" : "py-2"} ${t.name === highlight ? "bg-gold-soft" : "bg-bg"}`}>
          <span className="flex min-w-0 items-center gap-3 font-bold">
            <span className="w-8 shrink-0 text-center">{MEDAL[i] ?? `${i + 1}.`}</span>
            <span className="truncate">{t.name}</span>
          </span>
          <span className="shrink-0 font-mono font-bold tabular-nums">{t.score}</span>
        </li>
      ))}
    </ol>
  );
}
