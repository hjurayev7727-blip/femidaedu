import type { ReactNode } from "react";

/**
 * To'lov usullari: Payme — asosiy (birinchi, ajratilgan, «Tavsiya etiladi»), qolganlari — ikkinchi darajali.
 * Femida Edu sahifalari Telegram MainButton'siz ishlaydi, shuning uchun asosiy amal — birinchi katta tugma.
 */
export function RecommendedBadge() {
  return <span className="rounded-md bg-gold-soft px-2 py-0.5 text-xs font-extrabold uppercase tracking-wide text-gold">Tavsiya etiladi</span>;
}

/** Payme bloki: ajratilgan ramka + sarlavha yonida «Tavsiya etiladi» */
export function PaymePrimary({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="card space-y-3 border-2! border-brand!" aria-label="Payme orqali to'lash (tavsiya etiladi)">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-extrabold">{title}</h2>
        <RecommendedBadge />
      </div>
      {hint && <p className="text-sm text-mute">{hint}</p>}
      {children}
    </section>
  );
}

/** Boshqa (ikkinchi darajali) usullar — yig'ilgan holda; kerak bo'lsa ochiq turadi */
export function OtherPayMethods({ summary, open = false, children }: { summary: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="group rounded-xl border border-line bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold text-mute hover:text-ink">{summary}</summary>
      <div className="space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}
