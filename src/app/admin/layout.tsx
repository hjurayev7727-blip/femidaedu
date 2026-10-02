import Link from "next/link";
import { Logo } from "@/components/logo";
import { requireRole } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Umumiy" },
  { href: "/admin/tolovlar", label: "To'lovlar" },
  { href: "/admin/foydalanuvchilar", label: "Foydalanuvchilar" },
  { href: "/admin/yuristlar", label: "Yuristlar" },
  { href: "/admin/guruhlar", label: "Guruhlar" },
  { href: "/admin/musobaqalar", label: "Musobaqalar" },
  { href: "/admin/sozlamalar", label: "Sozlamalar" },
  { href: "/app", label: "← Ilovaga" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  // Har bir sahifa va amal o'zi ham requireRole("admin") ni tekshiradi — bu faqat birinchi to'siq
  await requireRole("admin");
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-hero border-b border-brand/25">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <span className="rounded-md bg-amber px-2 py-0.5 text-xs font-extrabold text-navy-2">ADMIN</span>
          </div>
          <nav className="flex flex-wrap items-center gap-1 text-sm font-bold">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-slate-300 hover:bg-white/10 hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
