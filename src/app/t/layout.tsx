import Link from "next/link";
import { Logo } from "@/components/logo";

/** Ulashilgan testlar — kirmagan foydalanuvchi (mehmon) uchun ham ochiq */
export default function SharedTestsLayout({ children }: LayoutProps<"/t">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-hero border-b border-brand/25">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3.5">
          <Logo href="/" />
          <nav className="flex items-center gap-1 text-sm font-bold">
            <Link href="/t" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white">Katalog</Link>
            <Link href="/app/testlar" className="rounded-lg px-3 py-2 text-gold-2 hover:bg-white/10">Mening testlarim</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
