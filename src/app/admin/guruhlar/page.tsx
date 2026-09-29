import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { setGroupPremium } from "../foydalanuvchilar/actions";

export const metadata: Metadata = { title: "Guruhlar" };

type Row = { id: number; name: string; grants_premium: boolean; created_at: string; profiles: { full_name: string } | null; group_members: { count: number }[] };

export default async function AdminGroups() {
  await requireRole("admin");
  const { data } = await createSupabaseAdmin()
    .from("groups")
    .select("id, name, grants_premium, created_at, profiles!groups_teacher_id_fkey(full_name), group_members(count)")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Guruhlar</h1>
        <p className="mt-1 text-mute">
          &quot;Premium guruh&quot; a&apos;zolari obunasiz Premium oladi — masalan, pullik kurs o&apos;quvchilari uchun.
        </p>
      </div>
      <ul className="card divide-y divide-line p-0!">
        {(data ?? []).map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <span>
              <span className="block font-bold">{g.name}</span>
              <span className="text-xs text-mute">{g.profiles?.full_name} · {g.group_members[0]?.count ?? 0} o&apos;quvchi</span>
            </span>
            <form action={setGroupPremium} className="flex items-center gap-2">
              <input type="hidden" name="group" value={g.id} />
              <input type="hidden" name="on" value={g.grants_premium ? "0" : "1"} />
              {g.grants_premium && <span className="rounded-lg bg-cyan-soft px-2 py-1 text-xs font-extrabold text-cyan-2">Premium guruh</span>}
              <button className={g.grants_premium ? "btn-ghost px-3! py-1.5! text-xs!" : "btn-primary px-3! py-1.5! text-xs!"}>
                {g.grants_premium ? "O'chirish" : "Premium qilish"}
              </button>
            </form>
          </li>
        ))}
        {!data?.length && <li className="px-5 py-4 text-sm text-mute">Hali guruh yo&apos;q.</li>}
      </ul>
    </div>
  );
}
