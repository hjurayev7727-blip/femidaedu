import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { joinGroup } from "./actions";

export const metadata: Metadata = { title: "Guruhga qo'shilish" };

type Info = { id: number; name: string; teacher_name: string; members: number; grants_premium: boolean };

export default async function JoinGroup({ params, searchParams }: PageProps<"/app/qoshilish/[kod]">) {
  const { kod } = await params;
  if (!z.string().regex(/^[a-f0-9]{6,32}$/).safeParse(kod).success) notFound();
  const { supabase, userId } = await requireUser();
  const sp = await searchParams;

  const { data } = await supabase.rpc("group_by_invite", { p_code: kod });
  const info = ((data ?? []) as Info[])[0];
  if (!info) {
    return (
      <div className="card mx-auto max-w-md text-center">
        <p className="font-extrabold">Havola noto&apos;g&apos;ri yoki eskirgan</p>
        <p className="mt-1 text-sm text-mute">O&apos;qituvchingizdan yangi havola so&apos;rang.</p>
        <Link href="/app" className="btn-ghost mt-4">Bosh sahifa</Link>
      </div>
    );
  }
  const { data: member } = await supabase.from("group_members").select("group_id").eq("group_id", info.id).eq("user_id", userId).maybeSingle();

  return (
    <div className="card mx-auto max-w-md space-y-4 text-center">
      <p className="text-4xl" aria-hidden>👥</p>
      <div>
        <h1 className="text-xl font-extrabold">{info.name}</h1>
        <p className="text-sm text-mute">O&apos;qituvchi: {info.teacher_name} · {info.members} o&apos;quvchi</p>
      </div>
      {info.grants_premium && <p className="rounded-xl bg-brand-soft px-4 py-2 text-sm font-semibold">Guruh a&apos;zolari Premium oladi ✨</p>}
      <p className="text-sm text-mute">Qo&apos;shilsangiz, o&apos;qituvchi mashq natijalaringizni ko&apos;radi va sizga vazifa bera oladi.</p>
      {sp.xato === "own" && <p className="text-sm font-semibold text-no">Bu sizning guruhingiz.</p>}
      {sp.xato && sp.xato !== "own" && <p className="text-sm font-semibold text-no">Qo&apos;shilib bo&apos;lmadi. Qayta urinib ko&apos;ring.</p>}
      {member ? (
        <Link href="/app" className="btn-ghost">Siz allaqachon a&apos;zosiz — bosh sahifa</Link>
      ) : (
        <form action={joinGroup}>
          <input type="hidden" name="code" value={kod} />
          <button className="btn-primary w-full">Guruhga qo&apos;shilish</button>
        </form>
      )}
    </div>
  );
}
