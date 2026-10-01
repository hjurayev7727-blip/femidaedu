import type { Metadata } from "next";
import { LawyerCabinetView } from "@/components/lawyers/cabinet-view";
import { requireUser } from "@/lib/auth";
import { fieldOptions, myLawyer } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { saveLawyerAction } from "./actions";

export const metadata: Metadata = { title: "Yurist kabineti" };

// Ro'yxatdan o'tish bo'lim yopiq paytda ham ochiq: katalog ochilganda bo'sh bo'lmasin
export default async function LawyerCabinet() {
  const { userId } = await requireUser();
  const [{ profile, verification }, fields, enabled] = await Promise.all([myLawyer(userId), fieldOptions(), lawyersEnabled()]);
  return <LawyerCabinetView profile={profile} verification={verification} fields={fields} enabled={enabled} action={saveLawyerAction} />;
}
