import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerificationView } from "@/components/lawyers/verification-view";
import { requireUser } from "@/lib/auth";
import { myLawyer } from "@/lib/lawyers-server";
import { createLicenseUploadAction, submitLicenseAction } from "../actions";

export const metadata: Metadata = { title: "Profilni tasdiqlash" };

export default async function VerifyPage() {
  const { userId } = await requireUser();
  const { profile, verification } = await myLawyer(userId);
  if (!profile || profile.status === "blocked") redirect("/app/yurist");
  return <VerificationView profile={profile} verification={verification} createUpload={createLicenseUploadAction} submit={submitLicenseAction} />;
}
