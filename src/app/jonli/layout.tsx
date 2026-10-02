import Link from "next/link";
import { Logo } from "@/components/logo";

/** Jonli viktorina — mehmonlar ham PIN bilan qo'shiladi */
export default function LiveLayout({ children }: LayoutProps<"/jonli">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-hero border-b border-brand/25">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
          <Logo href="/" />
          <nav className="flex items-center gap-1 text-sm font-bold">
            <Link href="/jonli" className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white">PIN kiritish</Link>
            <Link href="/app/testlar" className="rounded-lg px-3 py-2 text-gold-2 hover:bg-white/10">Mening testlarim</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
