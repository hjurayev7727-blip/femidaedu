import type { Metadata } from "next";
import Link from "next/link";
import { TelegramLogin } from "@/components/telegram-login";
import { requireUser } from "@/lib/auth";
import { isTechnicalEmail } from "@/lib/auth-telegram";
import { env } from "@/lib/env";
import { saveLeaderboardVisibility, saveNotifications } from "./actions";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profil" };

const TG_STATUS: Record<string, { ok: boolean; text: string }> = {
  ok: { ok: true, text: "Telegram hisobingiz bog'landi ✓" },
  band: { ok: false, text: "Bu Telegram hisobi boshqa akkauntga bog'langan." },
  xato: { ok: false, text: "Bog'lab bo'lmadi, qayta urinib ko'ring." },
};

export default async function ProfilePage({ searchParams }: PageProps<"/app/profil">) {
  const { profile, email, supabase } = await requireUser();
  const [{ data: premium }, { data: allBadges }, { data: mine }] = await Promise.all([
    supabase.rpc("is_premium"),
    supabase.from("badges").select("code, title, description, icon").returns<{ code: string; title: string; description: string; icon: string }[]>(),
    supabase.from("user_badges").select("badge_code, earned_at").eq("user_id", profile.id).returns<{ badge_code: string; earned_at: string }[]>(),
  ]);
  const earned = new Set((mine ?? []).map((b) => b.badge_code));
  const sp = await searchParams;
  const status = TG_STATUS[String(sp.telegram ?? "")];
  const linking = sp.boglash === "1";
  const bot = env().NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const isTechEmail = isTechnicalEmail(email);

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Profil</h1>

      <ProfileForm profile={profile} />

      <section className="card">
        <h2 className="font-extrabold">Nishonlar <span className="text-sm font-semibold text-mute">{earned.size}/{allBadges?.length ?? 0}</span></h2>
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {(allBadges ?? []).map((b) => (
            <li key={b.code} title={b.description}
              className={`rounded-xl px-2 py-3 text-center ${earned.has(b.code) ? "bg-brand-soft" : "bg-bg opacity-40 grayscale"}`}>
              <span className="block text-2xl" aria-hidden>{b.icon}</span>
              <span className="mt-1 block text-[11px] font-bold leading-tight">{b.title}</span>
              <span className="sr-only">{earned.has(b.code) ? "olingan" : "hali olinmagan"}: {b.description}</span>
            </li>
          ))}
        </ul>
      </section>

      <form action={saveLeaderboardVisibility} className="card flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name="visible" defaultChecked={profile.leaderboard_visible} className="accent-brand" />
          Reytingda ko&apos;rinish (faqat ism va familiyaning bosh harfi)
        </label>
        <button className="btn-ghost px-3! py-2! text-sm!">Saqlash</button>
      </form>

      <Link href="/app/premium" className="card flex items-center justify-between gap-3 hover:border-brand">
        <span>
          <span className="block font-extrabold">Tarif: {premium ? "Premium ✓" : "Bepul"}</span>
          <span className="text-sm text-mute">{premium ? "Muddat va to'lovlar tarixi" : "Cheksiz mashq va sinovlar"}</span>
        </span>
        <span className="font-bold text-brand-2">→</span>
      </Link>

      <Link href="/app/yurist" className="card flex items-center justify-between gap-3 hover:border-brand">
        <span>
          <span className="block font-extrabold">⚖️ Yurist kabineti</span>
          <span className="text-sm text-mute">Advokat yoki yuristmisiz? Katalogda bepul profil oching</span>
        </span>
        <span className="font-bold text-brand-2">→</span>
      </Link>

      <section className="card space-y-3">
        <h2 className="font-extrabold">Kirish usullari</h2>
        {email && !isTechEmail && <p className="text-sm text-mute">Google: {email}</p>}

        {status && (
          <p role="status" className={`rounded-xl px-4 py-3 text-sm font-semibold ${status.ok ? "bg-ok-soft text-ok" : "bg-no-soft text-no"}`}>
            {status.text}
          </p>
        )}

        {profile.telegram_id ? (
          <div className="space-y-3">
            <p className="text-sm">
              Telegram: <b>{profile.telegram_username ? `@${profile.telegram_username}` : "bog'langan"}</b>
            </p>
            {!profile.bot_enabled && bot && (
              <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm">
                Eslatmalar kelishi uchun botni oching va <b>Start</b> bosing:{" "}
                <a href={`https://t.me/${bot}?start=app`} target="_blank" rel="noreferrer" className="font-bold underline">@{bot}</a>
              </p>
            )}
            <form action={saveNotifications} className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="notify_morning" defaultChecked={profile.notify_morning} className="accent-brand" />
                08:00 — kunlik test
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" name="notify_evening" defaultChecked={profile.notify_evening} className="accent-brand" />
                20:00 — streak eslatmasi (bugun 10 ta savol yechilmagan bo&apos;lsa)
              </label>
              <button className="btn-ghost px-3! py-2! text-sm!">Eslatmalarni saqlash</button>
            </form>
          </div>
        ) : linking && bot ? (
          <div className="space-y-2">
            <p className="text-sm text-mute">Telegram orqali tasdiqlang:</p>
            <TelegramLogin bot={bot} authUrl={`${env().NEXT_PUBLIC_SITE_URL}/api/auth/telegram`} />
          </div>
        ) : (
          <form action="/api/auth/telegram/boglash" method="post">
            <p className="mb-3 text-sm text-mute">
              Telegram&apos;ni bog&apos;lasangiz, kunlik test, streak eslatmasi va natijalar botga keladi.
            </p>
            <button className="btn-ghost" disabled={!bot}>
              Telegram&apos;ni bog&apos;lash
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
