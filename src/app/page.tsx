import Link from "next/link";
import { Logo } from "@/components/logo";

const FEATURES = [
  { icon: "🎯", title: "Mavzu bo'yicha mashq", text: "52 ta qonunchilik hujjati va rasmiy spetsifikatsiya bo'limlari bo'yicha minglab savol." },
  { icon: "⏱️", title: "To'liq sinov imtihoni", text: "Milliy sertifikat formatida: 45 topshiriq, taymer, ball va taxminiy daraja." },
  { icon: "📖", title: "Izoh + qonun moddasi", text: "Har bir javobdan keyin nega to'g'riligi va tegishli modda matni ko'rsatiladi." },
  { icon: "🔁", title: "Xatolar ustida ishlash", text: "Xato qilgan savollaringiz 1 → 3 → 7 → 14 kun oralig'ida qayta beriladi." },
  { icon: "📊", title: "Zaif mavzular tahlili", text: "Qaysi bo'limda ball yo'qotayotganingizni va keyin nimani o'qish kerakligini bilasiz." },
  { icon: "🤖", title: "Telegram bot", text: "Har kuni 20 ta savol, streak eslatmalari va natijalar to'g'ridan-to'g'ri Telegram'da." },
];

// Rasmiy darajalar (Rasch modeli, maksimum 75 ball) — kun.uz / UZBMB
const GRADES = [
  { grade: "A+", min: "70+", note: "OTMga kirishda maksimal ball" },
  { grade: "A", min: "65", note: "OTMga kirishda maksimal ball" },
  { grade: "B+", min: "60", note: "Proporsional ball" },
  { grade: "B", min: "55", note: "Proporsional ball" },
  { grade: "C+", min: "50", note: "Proporsional ball" },
  { grade: "C", min: "46", note: "Proporsional ball" },
];

export default function Home() {
  return (
    <main className="flex-1">
      <section className="bg-hero text-white">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Logo />
          <Link href="/kirish" className="rounded-xl px-4 py-2 text-sm font-bold text-cyan-100 hover:bg-white/10">
            Kirish
          </Link>
        </header>
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
          <span className="tag bg-white/10! text-cyan-100!">Huquq · milliy sertifikat</span>
          <h1 className="mt-4 max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
            Maqsad bitta — <span className="text-cyan">A+</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-300">
            Huquq fanidan milliy sertifikat imtihoniga tizimli tayyorgarlik: mashq, sinov imtihoni va har bir javobga
            qonun moddasi bilan izoh.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/kirish" className="btn-primary">
              Bepul boshlash
            </Link>
            <a href="#darajalar" className="btn border-2 border-white/20 text-white">
              Darajalar qanday?
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-extrabold tracking-tight">Platformada nimalar bor</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <div className="text-2xl" aria-hidden>
                {f.icon}
              </div>
              <h3 className="mt-3 font-extrabold">{f.title}</h3>
              <p className="mt-1.5 text-[15px] text-mute">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="darajalar" className="mx-auto max-w-5xl px-4 pb-14">
        <h2 className="text-2xl font-extrabold tracking-tight">Sertifikat darajalari</h2>
        <p className="mt-2 max-w-2xl text-mute">
          Natija Rasch modeli bo&apos;yicha hisoblanadi, maksimal ball — 75. Sinov imtihonlarimizda ham shu shkala
          ishlatiladi.
        </p>
        <div className="card mt-6 overflow-x-auto p-0!">
          <table className="w-full text-left text-[15px]">
            <thead className="text-xs uppercase tracking-wider text-mute">
              <tr className="border-b border-line">
                <th className="px-5 py-3">Daraja</th>
                <th className="px-5 py-3">Ball</th>
                <th className="px-5 py-3">OTMga kirishda</th>
              </tr>
            </thead>
            <tbody>
              {GRADES.map((g) => (
                <tr key={g.grade} className="border-b border-line last:border-0">
                  <td className="px-5 py-3 font-extrabold text-cyan-2">{g.grade}</td>
                  <td className="px-5 py-3 font-semibold">{g.min}</td>
                  <td className="px-5 py-3 text-mute">{g.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-20">
        <div className="bg-hero rounded-[22px] px-6 py-10 text-center text-white sm:px-10">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Bugun boshlang — kuniga 20 ta savol bepul</h2>
          <p className="mx-auto mt-2 max-w-lg text-slate-300">Telegram yoki Google orqali 10 soniyada kiring.</p>
          <Link href="/kirish" className="btn-primary mt-6">
            Kirish
          </Link>
        </div>
      </section>

      <footer className="border-t border-line py-6 text-center text-sm text-mute">
        © {new Date().getFullYear()} A+ Huquq
      </footer>
    </main>
  );
}
