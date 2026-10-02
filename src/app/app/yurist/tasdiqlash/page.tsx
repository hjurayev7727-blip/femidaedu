import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyForm } from "@/components/lawyers/verify-form";
import { requireUser } from "@/lib/auth";
import { myLawyerProfile } from "@/lib/lawyers-server";
import { startLicenseUpload, submitVerificationAction } from "../actions";

export const metadata: Metadata = { title: "Profilni tasdiqlash" };

export default async function VerifyPage() {
  const { userId } = await requireUser();
  const me = await myLawyerProfile(userId);
  if (!me || me.verified_at || me.verification?.status === "pending") redirect("/app/yurist");
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/yurist" className="hover:underline">Yurist kabineti</Link> › Tasdiqlash</nav>
      <h1 className="text-2xl font-extrabold tracking-tight">&quot;Tasdiqlangan&quot; belgisini olish</h1>
      <p className="text-mute">Guvohnomangizni admin tekshiradi (odatda 1–2 ish kuni). Hujjat yopiq omborda saqlanadi va faqat tekshiruv uchun ishlatiladi.</p>
      <VerifyForm start={startLicenseUpload} submit={submitVerificationAction} />
    </div>
  );
}
