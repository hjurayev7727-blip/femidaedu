import Link from "next/link";
import { Logo } from "@/components/logo";

export type LegalSection = { title: string; items: string[] };

/** Maxfiylik siyosati va foydalanish shartlari uchun umumiy sahifa ko'rinishi. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <main className="flex-1">
      <section className="bg-hero text-white">
        <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Logo />
          <Link href="/kirish" className="rounded-xl px-4 py-2 text-sm font-bold text-gold-2 hover:bg-white/10">
            Kirish
          </Link>
        </header>
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-6">
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-slate-300">Oxirgi yangilanish: {updated}</p>
        </div>
      </section>

      <article className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-[15px] leading-relaxed">{intro}</p>
        {sections.map((s) => (
          <section key={s.title} className="mt-8">
            <h2 className="text-lg font-extrabold">{s.title}</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-mute">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </article>

      <LegalFooter />
    </main>
  );
}

export function LegalFooter() {
  return (
    <footer className="border-t border-line py-6 text-center text-sm text-mute">
      © {new Date().getFullYear()} Femida Edu — YURISTIM TEAM MChJ mahsuloti ·{" "}
      <Link href="/maxfiylik" className="hover:underline">
        Maxfiylik siyosati
      </Link>{" "}
      ·{" "}
      <Link href="/shartlar" className="hover:underline">
        Foydalanish shartlari
      </Link>
    </footer>
  );
}
