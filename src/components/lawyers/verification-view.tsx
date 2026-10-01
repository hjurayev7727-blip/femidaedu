import Link from "next/link";
import { fmtUz } from "@/lib/dates";
import type { Result } from "@/lib/lawyers";
import type { MyLawyer, MyVerification } from "@/lib/lawyers-server";
import { VerifyForm } from "./verify-form";

/** "Tasdiqlangan" belgisi uchun hujjat yuborish va holat */
export function VerificationView({ profile, verification, createUpload, submit }: {
  profile: MyLawyer;
  verification: MyVerification | null;
  createUpload: (file: unknown) => Promise<Result<{ path: string; token: string }>>;
  submit: (input: unknown) => Promise<Result<null>>;
}) {
  const advokat = profile.kind === "advokat";
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/app/yurist" className="text-sm font-semibold text-brand hover:underline">← Kabinet</Link>
      <div>
        <h1 className="text-3xl font-bold">Profilni tasdiqlash</h1>
        <p className="mt-2 text-mute">
          Ixtiyoriy. Tasdiqlangan yuristlar katalogda yuqorida turadi va &quot;✓ Tasdiqlangan&quot; belgisini oladi.
          {advokat ? " Advokatlik litsenziyasi (guvohnoma) rasmini yuboring." : " Yuridik oliy ma'lumot haqidagi diplom rasmini yuboring."}
          {" "}Ism-familiya hujjatdagi bilan bir xil bo&apos;lishi kerak: <b>{profile.display_name}</b>.
        </p>
      </div>

      {profile.verified_at ? (
        <p className="card font-bold text-ok">✓ Profilingiz {fmtUz(profile.verified_at, { time: false })} kuni tasdiqlangan.</p>
      ) : verification?.status === "pending" ? (
        <div className="card space-y-1">
          <p className="font-bold text-amber">Hujjatingiz ko&apos;rib chiqilmoqda</p>
          <p className="text-sm text-mute">Yuborilgan: {fmtUz(verification.created_at)} · raqam: {verification.license_no}. Odatda 1–2 ish kunida tekshiriladi.</p>
        </div>
      ) : (
        <>
          {verification?.status === "rejected" && (
            <p role="alert" className="rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">
              Oldingi hujjat tasdiqlanmadi: {verification.reason}. To&apos;g&apos;rilab, qayta yuboring.
            </p>
          )}
          <VerifyForm kind={profile.kind} createUpload={createUpload} submit={submit} />
        </>
      )}
    </div>
  );
}
