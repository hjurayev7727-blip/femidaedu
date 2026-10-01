import Link from "next/link";
import { fmtUz } from "@/lib/dates";
import type { MyLawyer, MyVerification } from "@/lib/lawyers-server";
import type { FieldInfo } from "./lawyer-card";
import { LawyerForm, type SaveLawyerState } from "./lawyer-form";

const STATUS = {
  active: { label: "Katalogda ko'rinadi", cls: "bg-ok-soft text-ok" },
  hidden: { label: "Yashirin", cls: "bg-line text-mute" },
  blocked: { label: "Bloklangan", cls: "bg-no-soft text-no" },
} as const;

function VerificationStatus({ profile, verification }: { profile: MyLawyer; verification: MyVerification | null }) {
  if (profile.verified_at) return <p className="text-sm"><b className="text-ok">✓ Tasdiqlangan</b> · {fmtUz(profile.verified_at, { time: false })}</p>;
  if (verification?.status === "pending") return <p className="text-sm"><b className="text-amber">Hujjatingiz ko&apos;rib chiqilmoqda</b> · {fmtUz(verification.created_at, { time: false })}</p>;
  return (
    <p className="text-sm">
      <b>Tasdiqlanmagan.</b> Guvohnoma yuborsangiz, &quot;✓ Tasdiqlangan&quot; belgisi va katalogda yuqori o&apos;rin olasiz.{" "}
      <Link href="/app/yurist/tasdiqlash" className="font-bold text-brand hover:underline">Hujjat yuborish →</Link>
    </p>
  );
}

/** Yurist kabineti: ro'yxatdan o'tish (bepul) yoki profilni tahrirlash */
export function LawyerCabinetView({ profile, verification, fields, enabled, action }: {
  profile: MyLawyer | null;
  verification: MyVerification | null;
  fields: FieldInfo[];
  enabled: boolean;
  action: (form: FormData) => Promise<SaveLawyerState>;
}) {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-3xl font-bold">{profile ? "Yurist kabineti" : "Yurist sifatida ro'yxatdan o'tish"}</h1>
        {!profile && (
          <p className="mt-2 text-mute">
            Ro&apos;yxatdan o&apos;tish bepul. Profilingiz soha va viloyat bo&apos;yicha katalogda ko&apos;rinadi; AI javobidan keyin
            &quot;Yuristga murojaat&quot; qilgan foydalanuvchilar sizni topadi. Kontaktlaringiz mijozga faqat platforma orqali to&apos;lovdan keyin ochiladi.
          </p>
        )}
      </div>

      {!enabled && (
        <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm font-semibold text-amber">
          Yuristlar katalogi hali ochilmagan. Profilingizni hozir to&apos;ldiring — bo&apos;lim ochilganda u katalogda bo&apos;ladi.
        </p>
      )}

      {profile && (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${STATUS[profile.status].cls}`}>{STATUS[profile.status].label}</span>
            {profile.status !== "blocked" && (
              <Link href={`/app/yuristlar/${profile.user_id}`} className="text-sm font-bold text-brand hover:underline">Ochiq profilni ko&apos;rish →</Link>
            )}
          </div>
          {profile.status === "blocked" ? (
            <p className="text-sm text-no">Profilingiz shikoyatlar sabab bloklangan va katalogda ko&apos;rinmaydi. Savol bo&apos;lsa, qo&apos;llab-quvvatlash xizmatiga yozing.</p>
          ) : <VerificationStatus profile={profile} verification={verification} />}
        </section>
      )}

      {profile?.status !== "blocked" && <LawyerForm initial={profile} fields={fields} action={action} />}
    </div>
  );
}
