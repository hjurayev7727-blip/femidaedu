import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";

const NAV = [
  { href: "/app", label: "Bosh sahifa", short: "Bosh", icon: "🏠" },
  { href: "/app/mashq", label: "Mashq", short: "Mashq", icon: "🎯" },
  { href: "/app/sohalar", label: "Sohalar", short: "Sohalar", icon: "⚖️" },
  { href: "/app/testlar", label: "Testlar", short: "Testlar", icon: "📝" },
  { href: "/app/imtihon", label: "Imtihon", short: "Imtihon", icon: "⏱️" },
  { href: "/app/takrorlash", label: "Takrorlash", short: "Xatolar", icon: "🔁" },
  { href: "/app/profil", label: "Profil", short: "Profil", icon: "👤" },
] as const;

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const { profile } = await requireUser();
  const extra = [
    { href: "/app/reyting", label: "Reyting", lg: true },
    { href: "/app/musobaqa", label: "Musobaqa", lg: true },
    ...(profile.role === "teacher" || profile.role === "admin" ? [{ href: "/app/ustoz", label: "Ustoz", lg: false }] : []),
    ...(["author", "reviewer", "admin"].includes(profile.role) ? [{ href: "/app/kontent", label: "Kontent", lg: false }] : []),
    ...(profile.role === "admin" ? [{ href: "/admin", label: "Admin", lg: false }] : []),
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-hero border-b border-brand/25 shadow-[0_6px_24px_-8px_rgba(15,23,42,.5)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3.5">
          <Logo href="/app" />
          <nav aria-label="Asosiy" className="hidden items-center gap-1 text-sm font-bold md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
            {extra.map((n) => (
              <Link key={n.href} href={n.href}
                className={`rounded-lg px-3 py-2 hover:bg-white/10 ${n.lg ? "hidden text-slate-300 hover:text-white lg:inline-block" : "text-amber"}`}>
                {n.label}
              </Link>
            ))}
            <form action="/auth/chiqish" method="post">
              <button className="rounded-lg px-3 py-2 text-slate-400 hover:bg-white/10 hover:text-white">Chiqish</button>
            </form>
          </nav>
          <div className="flex items-center gap-1 md:hidden">
            {extra.filter((n) => !n.lg).map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-2.5 py-2 text-sm font-bold text-amber hover:bg-white/10">
                {n.label}
              </Link>
            ))}
            <form action="/auth/chiqish" method="post">
              <button className="rounded-lg px-3 py-2 text-sm font-bold text-slate-400 hover:bg-white/10 hover:text-white">Chiqish</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:pb-6">{children}</main>

      {/* Mobil: pastki panel */}
      <nav aria-label="Asosiy (mobil)" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-7">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-bold text-mute hover:text-brand-2">
                <span className="text-lg leading-none" aria-hidden>{n.icon}</span>
                {n.short}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
