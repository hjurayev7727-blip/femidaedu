import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createGroup } from "./actions";

export const metadata: Metadata = { title: "Ustoz paneli" };

type Group = { id: number; name: string; created_at: string; grants_premium: boolean; group_members: { count: number }[] };

export default async function TeacherHome({ searchParams }: PageProps<"/app/ustoz">) {
  const { supabase, userId } = await requireRole("teacher", "admin");
  const sp = await searchParams;
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, created_at, grants_premium, group_members(count)")
    .eq("teacher_id", userId)
    .order("created_at", { ascending: false })
    .returns<Group[]>();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Ustoz paneli</h1>
        <p className="mt-1 text-mute">Guruh oching, taklif havolasini o&apos;quvchilarga yuboring, vazifa bering va natijalarni kuzating.</p>
        {sp.xato && (
          <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">
            {sp.xato === "nom" ? "Guruh nomi 2–60 belgi bo'lsin." : "Guruhni yaratib bo'lmadi."}
          </p>
        )}
      </div>

      <form action={createGroup} className="card flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm font-bold">
          Yangi guruh
          <input name="name" required minLength={2} maxLength={60} placeholder="Masalan: 11-A sinf yoki Kechki guruh"
            className="mt-1.5 w-full rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-brand" />
        </label>
        <button className="btn-primary">Yaratish</button>
      </form>

      {(groups ?? []).length === 0 ? (
        <p className="text-mute">Hali guruh yo&apos;q.</p>
      ) : (
        <ul className="card divide-y divide-line p-0!">
          {groups!.map((g) => (
            <li key={g.id}>
              <Link href={`/app/ustoz/${g.id}`} className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-bg">
                <span>
                  <span className="block font-extrabold">{g.name}</span>
                  <span className="text-sm text-mute">
                    {g.group_members[0]?.count ?? 0} o&apos;quvchi{g.grants_premium && " · Premium guruh"}
                  </span>
                </span>
                <span className="font-bold text-brand-2">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
