import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { longestOptionBias } from "@/lib/bias";
import type { Answer, Payload, QuestionType } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Savollar" };

type Q = { id: number; type: QuestionType; stem: string; payload: Payload; answer: Answer; status: string; difficulty: number; version: number };
const PAGE = 40;

export default async function QuestionList({ searchParams }: PageProps<"/app/kontent/savollar">) {
  await requireRole("author", "reviewer", "admin");
  const sp = await searchParams;
  const doc = Number(sp.hujjat) || null;
  const q = String(sp.q ?? "").trim().slice(0, 80);
  const onlyBiased = sp.filtr === "uzun";
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const admin = createSupabaseAdmin();

  const { data: docs } = await admin.from("documents").select("id, number, short_title").order("number").returns<{ id: number; number: number; short_title: string }[]>();
  const docId = docs?.find((d) => d.number === doc)?.id;

  // "Ko'zga tashlanadi" filtri TS da hisoblanadi — shuning uchun o'shanda kengroq oyna olinadi
  let query = admin.from("questions").select("id, type, stem, payload, answer, status, difficulty, version").order("id")
    .range(onlyBiased ? 0 : (page - 1) * PAGE, onlyBiased ? 3999 : page * PAGE - 1);
  if (docId) query = query.eq("document_id", docId);
  const safe = q.replace(/[%_\\,()*]/g, " ").trim();
  if (safe) query = /^\d+$/.test(safe) ? query.eq("id", Number(safe)) : query.ilike("stem", `%${safe}%`);
  const { data } = await query.returns<Q[]>();

  let rows = data ?? [];
  const biasOf = (x: Q) => ("options" in x.payload && "index" in x.answer ? longestOptionBias(x.payload.options, x.answer.index) : null);
  if (onlyBiased) rows = rows.filter((x) => biasOf(x)?.biased).slice((page - 1) * PAGE, page * PAGE);
  const link = (patch: Record<string, string | number | null>) => {
    const u = new URLSearchParams();
    const merged = { hujjat: doc, q: q || null, filtr: onlyBiased ? "uzun" : null, sahifa: null, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) u.set(k, String(v));
    return `/app/kontent/savollar?${u}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link href="/app/kontent" className="text-sm font-bold text-mute hover:text-ink">← Kontent paneli</Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Savollar</h1>
      </div>

      <form className="card flex flex-wrap items-end gap-3" action="/app/kontent/savollar">
        <label className="text-sm font-bold">Hujjat
          <select name="hujjat" defaultValue={doc ?? ""} className="mt-1.5 block rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold">
            <option value="">Hammasi</option>
            {(docs ?? []).map((d) => <option key={d.number} value={d.number}>№{d.number} {d.short_title}</option>)}
          </select>
        </label>
        <label className="min-w-0 flex-1 text-sm font-bold">Matn yoki ID
          <input name="q" defaultValue={q} className="mt-1.5 block w-full rounded-xl border-2 border-line bg-card px-3 py-2 font-semibold" />
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm font-semibold">
          <input type="checkbox" name="filtr" value="uzun" defaultChecked={onlyBiased} className="accent-cyan-600" /> Javobi ko&apos;zga tashlanadi
        </label>
        <button className="btn-primary px-4! py-2.5! text-sm!">Qidirish</button>
      </form>

      <ul className="card divide-y divide-line p-0!">
        {rows.map((x) => {
          const b = biasOf(x);
          return (
            <li key={x.id}>
              <Link href={`/app/kontent/savollar/${x.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-bg">
                <span className="w-14 shrink-0 text-xs font-bold text-mute tabular-nums">#{x.id}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{x.stem}</span>
                  <span className="text-xs text-mute">
                    {x.type} · {x.status} · qiyinlik {x.difficulty} · v{x.version}
                    {b?.biased && <b className="text-amber"> · javob ×{b.ratio.toFixed(1)} uzun</b>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
        {!rows.length && <li className="px-5 py-4 text-sm text-mute">Topilmadi.</li>}
      </ul>

      <div className="flex justify-between">
        {page > 1 ? <Link href={link({ sahifa: page - 1 })} className="btn-ghost">← Oldingi</Link> : <span />}
        {rows.length === PAGE && <Link href={link({ sahifa: page + 1 })} className="btn-ghost">Keyingi →</Link>}
      </div>
    </div>
  );
}
