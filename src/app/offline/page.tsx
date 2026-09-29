import type { Metadata } from "next";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Internet yo'q" };
export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="bg-hero flex flex-1 flex-col items-center justify-center px-4 text-center text-white">
      <Logo />
      <p className="mt-6 text-4xl" aria-hidden>📡</p>
      <h1 className="mt-3 text-xl font-extrabold">Internet aloqasi yo&apos;q</h1>
      <p className="mt-2 max-w-xs text-slate-300">Ulanish tiklangach sahifani yangilang — mashqingiz serverda saqlangan.</p>
      {/* oddiy havola: offline sahifada JS bo'lmasligi mumkin */}
      <a href="/app" className="btn-primary mt-6">Qayta urinish</a>
    </main>
  );
}
