"use client";
import { useActionState, useState } from "react";
import type { FormState } from "@/app/app/buyurtmalar/actions";

type Act = (s: FormState, f: FormData) => Promise<FormState>;
const input = "mt-1 w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-normal outline-none focus:border-brand";

export function ReceiptForm({ order, action }: { order: number; action: Act }) {
  const [state, act, pending] = useActionState(action, null);
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="order" value={order} />
      <label className="block text-sm font-bold">To&apos;lov cheki (rasm yoki PDF, 5 MB gacha)
        <input type="file" name="receipt" required accept="image/jpeg,image/png,image/webp,application/pdf" className="mt-1 block w-full text-sm" />
      </label>
      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <button className="btn-ghost" disabled={pending}>{pending ? "Yuklanmoqda…" : "Chekni yuborish"}</button>
    </form>
  );
}

export function DisputeForm({ order, action }: { order: number; action: Act }) {
  const [open, setOpen] = useState(false);
  const [state, act, pending] = useActionState(action, null);
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-ghost text-no">⚠️ E&apos;tiroz bildirish</button>;
  return (
    <form action={act} className="w-full space-y-2">
      <input type="hidden" name="order" value={order} />
      <label className="block text-sm font-bold">Nima noto&apos;g&apos;ri?
        <textarea name="reason" required minLength={10} maxLength={2000} rows={3} className={input} />
      </label>
      <p className="text-xs text-mute">E&apos;tirozdan keyin to&apos;lov to&apos;xtatiladi va admin ikkala tomonni eshitib qaror qiladi.</p>
      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <div className="flex gap-2">
        <button className="btn-primary !py-2" disabled={pending}>Yuborish</button>
        <button type="button" className="btn-ghost !py-2" onClick={() => setOpen(false)}>Bekor qilish</button>
      </div>
    </form>
  );
}

export function ReviewForm({ order, action }: { order: number; action: Act }) {
  const [rating, setRating] = useState(0);
  const [state, act, pending] = useActionState(action, null);
  if (state?.ok) return <p role="status" className="font-semibold text-ok">Bahoyingiz uchun rahmat!</p>;
  return (
    <form action={act} className="space-y-2">
      <input type="hidden" name="order" value={order} />
      <input type="hidden" name="rating" value={rating} />
      <div role="radiogroup" aria-label="Baho" className="flex gap-1 text-3xl">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} yulduz`} onClick={() => setRating(n)}
            className={n <= rating ? "text-amber" : "text-line"}>★</button>
        ))}
      </div>
      <textarea name="body" maxLength={1000} rows={3} placeholder="Fikringiz (ixtiyoriy)" className={input} />
      {state && !state.ok && <p role="alert" className="text-sm font-semibold text-no">{state.message}</p>}
      <button className="btn-primary !py-2" disabled={pending || rating === 0}>Baholash</button>
    </form>
  );
}
