// Faqat ishlab chiqish uchun: to'lov formasi ko'rinishi (yuborish Supabase'siz ishlamaydi).
import { notFound } from "next/navigation";
import { PayForm } from "@/app/app/premium/pay-form";
import { formatUzs } from "@/lib/payments";

export default function DevPremium() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-6">
      <p className="rounded-xl bg-amber-soft px-4 py-2 text-sm font-semibold">DEV · to&apos;lov formasi (yuborilmaydi)</p>
      <div className="card">
        <PayForm plans={[
          { code: "oy1", title: "1 oy", months: 1, price: formatUzs(49000) },
          { code: "oy3", title: "3 oy", months: 3, price: formatUzs(129000) },
        ]} />
      </div>
    </main>
  );
}
