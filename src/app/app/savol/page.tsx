import type { Metadata } from "next";
import Link from "next/link";
import { LegalChat } from "@/components/legal/legal-chat";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { DOC_FREE_WEEKLY, DOC_PREMIUM_WEEKLY } from "@/lib/legal";
import { lawyersEnabled } from "@/lib/legal-server";
import { TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY } from "@/lib/tutor";
import { uzWeekStart } from "@/lib/user-tests";
import { analyzeAction, askLegalAction, createUploadAction } from "./actions";

export const metadata: Metadata = { title: "Savol bering" };
export const maxDuration = 300;

type Thread = { id: string; mode: "legal" | "document"; title: string; updated_at: string };

export default async function LegalPage({ searchParams }: PageProps<"/app/savol">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireUser();
  const [{ data: threads }, { data: premium }, { data: week }, lawyers] = await Promise.all([
    supabase.from("tutor_threads").select("id, mode, title, updated_at").eq("user_id", userId).in("mode", ["legal", "document"])
      .order("updated_at", { ascending: false }).limit(30).returns<Thread[]>(),
    supabase.rpc("is_premium"),
    supabase.from("ai_weekly").select("tutor, docs").eq("user_id", userId).eq("week", uzWeekStart()).maybeSingle<{ tutor: number; docs: number }>(),
    lawyersEnabled(),
  ]);
  const p = Boolean(premium);
  return (
    <div className="space-y-6">
      <section className="bg-hero rounded-[22px] p-6 text-white">
        <p className="tag !bg-white/10 !text-gold-2">Huquqiy yordam</p>
        <h1 className="mt-3 text-3xl font-bold">Savolingizga qonun moddasi bilan javob</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-300">
          Vaziyatingizni yozing yoki shartnoma, ariza rasmini yuklang — javob amaldagi qonun moddalari havolasi bilan beriladi:
          qayerga, qaysi muddatda va qanday hujjat bilan murojaat qilish.
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-400">
          Bu hafta: {week?.tutor ?? 0}/{p ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY} savol · {week?.docs ?? 0}/{p ? DOC_PREMIUM_WEEKLY : DOC_FREE_WEEKLY} hujjat
          {!p && <> · <Link href="/app/premium" className="text-gold-2 underline">Premium</Link></>}
        </p>
      </section>

      <LegalChat threadId={null} messages={[]} ask={askLegalAction} createUpload={createUploadAction} analyze={analyzeAction}
        aiReady={aiEnabled()} lawyersEnabled={lawyers} initialTab={sp.tur === "hujjat" ? "hujjat" : "savol"} />

      {threads && threads.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Oldingi savollar</h2>
          <ul className="space-y-2">
            {threads.map((t) => (
              <li key={t.id}>
                <Link href={`/app/savol/${t.id}`} className="card flex items-center justify-between gap-3 !py-3 hover:border-brand/40">
                  <span className="truncate"><span aria-hidden>{t.mode === "document" ? "📄" : "💬"}</span> {t.title}</span>
                  <span className="shrink-0 text-xs text-mute">{fmtUz(t.updated_at, { short: true })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-mute">
        Huquqni o&apos;rganyapsizmi? Moddalarni tushuntirish, kazus tahlili va o&apos;quv reja —{" "}
        <Link href="/app/yordamchi" className="font-semibold text-brand hover:underline">AI ustoz</Link>.
      </p>
    </div>
  );
}
