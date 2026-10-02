import type { Metadata } from "next";
import Link from "next/link";
import { VerifiedBadge } from "@/components/lawyers/lawyer-card";
import { LawyerProfileForm } from "@/components/lawyers/profile-form";
import { requireUser } from "@/lib/auth";
import { myLawyerProfile } from "@/lib/lawyers-server";
import { saveProfileAction } from "./actions";

export const metadata: Metadata = { title: "Yurist kabineti" };

export default async function LawyerCabinet() {
  const { supabase, userId, profile } = await requireUser();
  const [me, { data: fields }] = await Promise.all([
    myLawyerProfile(userId),
    supabase.from("fields").select("slug, title").order("priority").order("title").returns<{ slug: string; title: string }[]>(),
  ]);
  const v = me?.verification;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Yurist kabineti</h1>
        <p className="mt-1 text-mute">
          {me ? "Profilingiz mijozlarga katalogda ko'rinadi." : "Ro'yxatdan o'tish bepul. Profil to'ldirilgach katalogda ko'rinasiz va mijozlardan ariza olasiz."}
        </p>
      </div>

      {me?.status === "blocked" && (
        <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">Profilingiz shikoyatlar sababli bloklangan va katalogda ko&apos;rinmaydi.</p>
      )}

      {me && (
        <section className="card flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <VerifiedBadge verified={Boolean(me.verified_at)} />
            <p className="text-sm text-mute">
              {me.verified_at ? "Guvohnomangiz tekshirilgan — qidiruvda yuqorida chiqasiz."
                : v?.status === "pending" ? "Guvohnoma ko'rib chiqilmoqda."
                : v?.status === "rejected" ? `Rad etildi${v.reason ? `: ${v.reason}` : ""}. Qayta yuborishingiz mumkin.`
                : "Advokatlik guvohnomasini yuborsangiz, \"Tasdiqlangan\" belgisini olasiz va qidiruvda yuqorida chiqasiz."}
            </p>
          </div>
          <div className="flex gap-2">
            {!me.verified_at && v?.status !== "pending" && <Link href="/app/yurist/tasdiqlash" className="btn-primary">Tasdiqlash</Link>}
            <Link href={`/app/yuristlar/${userId}`} className="btn-ghost">Profilni ko&apos;rish</Link>
          </div>
        </section>
      )}

      <LawyerProfileForm profile={me} defaultName={profile.full_name} fields={fields ?? []} action={saveProfileAction} />
      <p className="text-xs text-mute">Ro&apos;yxatdan o&apos;tib, platforma <Link href="/shartlar" className="underline">foydalanish shartlari</Link>ga rozilik bildirasiz. Platforma komissiyasi — har bir buyurtmadan kamida 20%.</p>
    </div>
  );
}
