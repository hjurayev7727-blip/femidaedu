import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { daysUntil, effectiveStreak, fmtWhen, serverNow } from "@/lib/dates";
import { startAssignment, startDaily } from "./mashq/actions";

export const metadata: Metadata = { title: "Bosh sahifa" };

// Norasmiy manbalar va kurs rejasi bo'yicha. UZBMB rasmiy e'lon qilganda tekshirib yangilang.
const EXAM_DATE = new Date("2026-12-23T09:00:00+05:00");

export default async function Dashboard({ searchParams }: PageProps<"/app">) {
  const { supabase, profile, userId } = await requireUser();
  const sp = await searchParams;

  const [{ data: premium }, { data: lastMock }, { data: due }, { data: daily }, { data: usage }, { data: asg }, { data: board }, { data: nextContest }] = await Promise.all([
    supabase.rpc("is_premium"),
    supabase
      .from("attempts")
      .select("scaled_score, grade")
      .eq("user_id", userId)
      .eq("mode", "mock")
      .not("finished_at", "is", null)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ scaled_score: number; grade: string | null }>(),
    supabase.rpc("my_review_due"),
    supabase
      .from("attempts")
      .select("id, finished_at, correct_count, question_ids, started_at")
      .eq("user_id", userId)
      .eq("mode", "daily")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; finished_at: string | null; correct_count: number | null; question_ids: number[]; started_at: string }>(),
    supabase.from("daily_usage").select("questions, day").eq("user_id", userId).order("day", { ascending: false }).limit(1)
      .maybeSingle<{ questions: number; day: string }>(),
    supabase.rpc("my_assignments"),
    supabase.rpc("leaderboard", { p_period: "week", p_region: null, p_limit: 3 }),
    supabase.from("contests").select("id, title, starts_at, ends_at").gt("ends_at", new Date().toISOString()).order("starts_at").limit(1)
      .maybeSingle<{ id: number; title: string; starts_at: string; ends_at: string }>(),
  ]);
  const myRank = ((board ?? []) as { rank: number; score: number; is_me: boolean }[]).find((r) => r.is_me);
  const assignments = (asg ?? []) as {
    id: number; title: string; group_name: string; topic_title: string | null; question_count: number;
    due_at: string | null; attempt_id: string | null; finished: boolean; score: number | null;
  }[];

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
  const dailyToday = daily && new Date(daily.started_at).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }) === today ? daily : null;
  const usedToday = usage?.day === today ? usage.questions : 0;
  const dueCount = Number(due ?? 0);
  const daysLeft = daysUntil(EXAM_DATE);
  const firstName = profile.full_name.split(" ")[0] || "do'st";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Salom, {firstName}! 👋</h1>
        <p className="mt-1 text-mute">
          Imtihongacha <b className="text-ink">{daysLeft} kun</b> qoldi ·{" "}
          {premium ? (
            <Link href="/app/premium" className="font-bold text-cyan-2">Premium ✓</Link>
          ) : (
            <>
              Bepul tarif · bugun {usedToday}/20 savol ·{" "}
              <Link href="/app/premium" className="font-bold text-cyan-2 underline-offset-2 hover:underline">Premium</Link>
            </>
          )}
        </p>
        {sp.xato === "kunlik" && (
          <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">Kunlik testni ochib bo&apos;lmadi.</p>
        )}
        {sp.xato === "vazifa" && (
          <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">Vazifani ochib bo&apos;lmadi.</p>
        )}
        {sp.guruh === "ok" && (
          <p role="status" className="mt-3 rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">Guruhga qo&apos;shildingiz ✓</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Streak" value={`🔥 ${effectiveStreak(profile.streak_days, profile.last_active_on)} kun`} hint={`Eng yaxshisi: ${profile.streak_best} · kuniga 10 savol`} />
        <Stat
          label="Taxminiy daraja"
          value={lastMock ? `${lastMock.grade ?? "—"} · ${Number(lastMock.scaled_score)}` : "—"}
          hint={lastMock ? "Oxirgi sinov imtihoni (75 ballik)" : "Birinchi sinov imtihonidan keyin"}
        />
        <Stat label="Takrorlash" value={`${dueCount} savol`} hint="Bugun takrorlanishi kerak" />
      </div>

      {assignments.length > 0 && (
        <section className="card">
          <h2 className="font-extrabold">Vazifalarim</h2>
          <ul className="mt-2 divide-y divide-line">
            {assignments.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block font-bold">{a.title}</span>
                  <span className="text-sm text-mute">
                    {a.group_name} · {a.topic_title} · {a.question_count} savol
                    {a.due_at && ` · ${new Date(a.due_at).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "short" })} gacha`}
                  </span>
                </span>
                {a.finished ? (
                  <Link href={`/app/mashq/s/${a.attempt_id}/natija`} className="text-sm font-bold text-ok">✓ {Math.round(Number(a.score))}%</Link>
                ) : (
                  <form action={startAssignment}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="btn-primary px-4! py-2! text-sm!">{a.attempt_id ? "Davom ettirish" : "Boshlash"}</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <span className="tag">Har kuni</span>
          <h2 className="mt-3 text-lg font-extrabold">Kunlik test</h2>
          <p className="mt-1 text-mute">Hamma uchun bir xil 10 ta savol — bugungi natijangizni tekshiring.</p>
          {dailyToday?.finished_at ? (
            <Link href={`/app/mashq/s/${dailyToday.id}/natija`} className="btn-ghost mt-4">
              Bugun: {dailyToday.correct_count}/{dailyToday.question_ids.length} ✓ — natija
            </Link>
          ) : (
            <form action={startDaily} className="mt-4">
              <button className="btn-primary">{dailyToday ? "Davom ettirish" : "Boshlash"}</button>
            </form>
          )}
        </div>

        <div className="card">
          <span className="tag">Xatolar</span>
          <h2 className="mt-3 text-lg font-extrabold">Takrorlash</h2>
          <p className="mt-1 text-mute">Xato qilgan savollaringiz kerakli kuni qayta beriladi.</p>
          <Link href="/app/takrorlash" className={`${dueCount ? "btn-primary" : "btn-ghost"} mt-4`}>
            {dueCount ? `${dueCount} ta savolni takrorlash` : "Navbatni ko'rish"}
          </Link>
        </div>

        <div className="card">
          <span className="tag">3 000+ savol</span>
          <h2 className="mt-3 text-lg font-extrabold">Mavzu bo&apos;yicha mashq</h2>
          <p className="mt-1 text-mute">52 ta qonunchilik hujjati va 8–11-sinf darsliklari.</p>
          <Link href="/app/mashq" className="btn-ghost mt-4">Mavzuni tanlash →</Link>
        </div>

        <div className="card">
          <span className="tag">Bu hafta</span>
          <h2 className="mt-3 text-lg font-extrabold">Reyting</h2>
          <p className="mt-1 text-mute">
            {myRank ? `Siz #${myRank.rank} o'rindasiz · ${Number(myRank.score)} ball` : "Haftada 20 ta savol yeching — reytingga kirasiz."}
          </p>
          <Link href="/app/reyting" className="btn-ghost mt-4">Reytingni ko&apos;rish →</Link>
        </div>

        <div className="card">
          <span className="tag">Musobaqa</span>
          <h2 className="mt-3 text-lg font-extrabold">{nextContest ? nextContest.title : "Onlayn musobaqalar"}</h2>
          <p className="mt-1 text-mute">
            {nextContest
              ? Date.parse(nextContest.starts_at) <= serverNow()
                ? "Hozir bo'lyapti — qo'shiling!"
                : `Boshlanishi: ${fmtWhen(nextContest.starts_at)}`
              : "Hamma bir vaqtda bir xil savollarni ishlaydi, g'oliblar nishon oladi."}
          </p>
          <Link href={nextContest ? `/app/musobaqa/${nextContest.id}` : "/app/musobaqa"} className={`${nextContest ? "btn-primary" : "btn-ghost"} mt-4`}>
            {nextContest ? "Musobaqaga →" : "Musobaqalar →"}
          </Link>
        </div>

        <div className="card">
          <span className="tag">45 topshiriq</span>
          <h2 className="mt-3 text-lg font-extrabold">Sinov imtihoni</h2>
          <p className="mt-1 text-mute">Milliy sertifikat formatida: taymer, 75 ballik shkala, A+ … C daraja.</p>
          <Link href="/app/imtihon" className="btn-ghost mt-4">Sinovga o&apos;tish →</Link>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card">
      <p className="text-xs font-bold uppercase tracking-wider text-mute">{label}</p>
      <p className="mt-2 text-2xl font-extrabold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-sm text-mute">{hint}</p>}
    </div>
  );
}
