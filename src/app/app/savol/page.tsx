import type { Metadata } from "next";
import Link from "next/link";
import { DocUpload } from "@/components/legal/doc-upload";
import { LegalChat } from "@/components/legal/legal-chat";
import { SavolTabs } from "@/components/legal/savol-tabs";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { DOC_FREE_WEEKLY, DOC_PREMIUM_WEEKLY } from "@/lib/legal";
import { lawyersEnabled } from "@/lib/legal-server";
import { TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY } from "@/lib/tutor";
import { uzWeekStart } from "@/lib/user-tests";
import { analyzeDocAction, askLegalAction, startDocUpload } from "./actions";

export const metadata: Metadata = { title: "Savol bering" };
export const maxDuration = 300;

type Thread = { id: string; mode: "legal" | "document"; title: string; updated_at: string };

export default async function SavolPage({ searchParams }: PageProps<"/app/savol">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireUser();
  const [{ data: threads }, { data: premium }, { data: week }, lawyers] = await Promise.all([
    supabase.from("tutor_threads").select("id, mode, title, updated_at").eq("user_id", userId).in("mode", ["legal", "document"])
      .order("updated_at", { ascending: false }).limit(30).returns<Thread[]>(),
    supabase.rpc("is_premium"),
    supabase.from("ai_weekly").select("tutor, docs").eq("user_id", userId).eq("week", uzWeekStart()).maybeSingle<{ tutor: number; docs: number }>(),
    lawyersEnabled(),
  ]);
  const ai = aiEnabled();
  const qLimit = premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="bg-hero rounded-[22px] px-5 py-6 text-white sm:px-7">
        <p className="tag !bg-white/10 !text-gold-2">Huquqiy yordam</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Savolingizni yozing yoki hujjatni yuklang</h1>
        <p className="mt-1 max-w-xl text-slate-300">
          Javob O&apos;zbekiston qonunlari — Konstitutsiya, kodekslar va asosiy qonunlar moddalari asosida, har bir fikr manbasi bilan beriladi.
        </p>
        <p className="mt-3 text-sm text-slate-400">Bu hafta: {week?.tutor ?? 0}/{qLimit} savol{!premium && <> · <Link href="/app/premium" className="font-bold text-gold-2 hover:underline">Premium</Link></>}</p>
      </section>

      {typeof sp.xato === "string" && <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">{sp.xato.slice(0, 200)}</p>}

      <SavolTabs
        initial={sp.tab === "hujjat" ? "doc" : "ask"}
        ask={<LegalChat threadId={null} messages={[]} ask={askLegalAction} aiReady={ai} lawyersEnabled={lawyers} />}
        doc={<DocUpload start={startDocUpload} analyze={analyzeDocAction} aiReady={ai} weekUsed={week?.docs ?? 0} weekLimit={premium ? DOC_PREMIUM_WEEKLY : DOC_FREE_WEEKLY} />}
      />

      {(threads ?? []).length > 0 && (
        <section className="card !p-0">
          <h2 className="px-5 pt-4 font-extrabold">Oldingi savollarim</h2>
          <ul className="mt-2 divide-y divide-line">
            {(threads ?? []).map((t) => (
              <li key={t.id}>
                <Link href={`/app/savol/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-bg">
                  <span className="truncate"><span aria-hidden>{t.mode === "document" ? "📄" : "💬"}</span> {t.title}</span>
                  <span className="shrink-0 text-xs text-mute">{fmtUz(t.updated_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-sm text-mute">
        Huquqni chuqurroq o&apos;rganmoqchimisiz? <Link href="/app/yordamchi" className="font-bold text-brand-2 hover:underline">AI yordamchi</Link> — moddalarni tushuntirish, kazuslar va o&apos;quv reja.
      </p>
    </div>
  );
}
