import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LawyerListItem } from "@/components/lawyers/lawyer-card";
import { requireUser } from "@/lib/auth";
import { REGIONS } from "@/lib/lawyers";
import { lawyerCatalog } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";

export const metadata: Metadata = { title: "Yuristlar" };

const PER_PAGE = 20;
const str = (v: unknown, re: RegExp) => (typeof v === "string" && re.test(v) ? v : null);

export default async function LawyersPage({ searchParams }: PageProps<"/app/yuristlar">) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();
  if (!(await lawyersEnabled()) && profile.role !== "admin") notFound();
  const field = str(sp.soha, /^[a-z-]{2,40}$/);
  const region = typeof sp.hudud === "string" && (REGIONS as readonly string[]).includes(sp.hudud) ? sp.hudud : null;
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim().slice(0, 60) : null;
  const page = Math.max(1, Math.min(50, Number(sp.sahifa) || 1));
  const [{ data: fields }, list] = await Promise.all([
    supabase.from("fields").select("slug, title").order("priority").order("title").returns<{ slug: string; title: string }[]>(),
    lawyerCatalog({ field, region, q, page }, PER_PAGE),
  ]);
  const titles = Object.fromEntries((fields ?? []).map((f) => [f.slug, f.title]));
  const pages = Math.ceil(list.total / PER_PAGE);
  const qs = (p: number) => `?${new URLSearchParams({ ...(field && { soha: field }), ...(region && { hudud: region }), ...(q && { q }), sahifa: String(p) })}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Yuristlar</h1>
          <p className="mt-1 text-mute">Soha bo&apos;yicha yurist tanlang, yozing yoki ariza qoldiring. To&apos;lov xizmat bajarilgach yuristga o&apos;tadi.</p>
        </div>
        <Link href="/app/yurist" className="btn-ghost">⚖️ Men yuristman</Link>
      </div>

      <form className="card grid gap-3 !p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select name="soha" defaultValue={field ?? ""} className="rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold">
          <option value="">Barcha sohalar</option>
          {(fields ?? []).map((f) => <option key={f.slug} value={f.slug}>{f.title}</option>)}
        </select>
        <select name="hudud" defaultValue={region ?? ""} className="rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold">
          <option value="">Barcha hududlar</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input name="q" defaultValue={q ?? ""} maxLength={60} placeholder="Ism bo'yicha qidirish" className="rounded-xl border-2 border-line bg-card px-3 py-2" />
        <button className="btn-primary !py-2">Qidirish</button>
      </form>

      {list.items.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.items.map((l) => <LawyerListItem key={l.id} l={l} fieldTitles={titles} />)}
        </div>
      ) : (
        <p className="card text-center text-mute">Bu filtr bo&apos;yicha yurist topilmadi. Boshqa soha yoki hududni tanlang.</p>
      )}

      {pages > 1 && (
        <nav className="flex justify-center gap-2" aria-label="Sahifalar">
          {page > 1 && <Link href={qs(page - 1)} className="btn-ghost">← Oldingi</Link>}
          <span className="px-3 py-2 text-sm font-bold text-mute">{page} / {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="btn-ghost">Keyingi →</Link>}
        </nav>
      )}
      <p className="text-center text-xs text-mute">Tasdiqlanmagan yuristlarning guvohnomasi platforma tomonidan tekshirilmagan. Muammo bo&apos;lsa, profil sahifasidagi &quot;Shikoyat&quot; tugmasidan foydalaning.</p>
    </div>
  );
}
