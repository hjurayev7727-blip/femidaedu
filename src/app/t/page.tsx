import type { Metadata } from "next";
import Link from "next/link";
import { createSupabase } from "@/lib/supabase/server";
import { ratingText } from "@/lib/user-tests";
import { openCode } from "./actions";

export const metadata: Metadata = {
  title: "Ochiq testlar katalogi",
  description: "Huquq bo'yicha foydalanuvchilar yaratgan, tekshiruvdan o'tgan testlar.",
};

type Row = { code: string; title: string; author: string; trust: number; field: string | null; field_icon: string | null; items: number; rating: number | null; rating_n: number; attempts: number };

export default async function CatalogPage({ searchParams }: PageProps<"/t">) {
  const sp = await searchParams;
  const soha = typeof sp.soha === "string" && /^[a-z-]{2,40}$/.test(sp.soha) ? sp.soha : null;
  const supabase = await createSupabase();
  const [{ data }, { data: fields }] = await Promise.all([
    supabase.rpc("test_catalog", { p_field: soha, p_limit: 60 }),
    supabase.from("fields").select("slug, title, icon").order("sort").returns<{ slug: string; title: string; icon: string }[]>(),
  ]);
  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Ochiq testlar</h1>
      <form action={openCode} className="card flex flex-wrap items-end gap-3">
        <label className="flex-1 text-sm font-bold">
          Kod bilan ochish
          <input name="code" required maxLength={8} autoComplete="off" placeholder="K7Q2XM"
            className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3 py-2.5 font-mono text-lg font-bold uppercase tracking-[.3em] outline-none focus:border-brand" />
        </label>
        <button className="btn-primary">Ochish</button>
        {sp.xato === "kod" && <p role="alert" className="w-full text-sm font-semibold text-no">Kod 6 belgidan iborat.</p>}
      </form>

      <nav aria-label="Sohalar" className="flex gap-2 overflow-x-auto pb-1">
        <Link href="/t" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${!soha ? "bg-brand text-white" : "bg-card text-mute"}`}>Hammasi</Link>
        {(fields ?? []).map((f) => (
          <Link key={f.slug} href={`/t?soha=${f.slug}`} className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${soha === f.slug ? "bg-brand text-white" : "bg-card text-mute"}`}>
            {f.icon} {f.title}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="card text-center text-mute">Bu bo&apos;limda hali tekshiruvdan o&apos;tgan test yo&apos;q.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => (
            <li key={r.code}>
              <Link href={`/t/${r.code}`} className="card block h-full hover:border-brand/40">
                <span className="text-xs font-bold text-mute">{r.field_icon} {r.field ?? "Umumiy"}</span>
                <b className="mt-1 block leading-snug">{r.title}</b>
                <span className="mt-2 block text-sm text-mute">
                  {r.author}{r.trust >= 2 ? " ⚖️" : ""} · {r.items} savol · {ratingText(r.rating == null ? null : Number(r.rating), r.rating_n)} · {r.attempts} marta
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
