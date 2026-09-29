import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { serverNow } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { grantPremium, setRole } from "./actions";

export const metadata: Metadata = { title: "Foydalanuvchilar" };

type Row = {
  id: string; full_name: string; telegram_username: string | null; role: string; region: string | null; created_at: string;
  subscriptions: { ends_at: string }[];
};

const ROLE_LABEL: Record<string, string> = { student: "O'quvchi", teacher: "O'qituvchi", author: "Muallif", reviewer: "Ekspert", admin: "Admin" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/foydalanuvchilar">) {
  await requireRole("admin");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 60);
  let query = createSupabaseAdmin()
    .from("profiles")
    .select("id, full_name, telegram_username, role, region, created_at, subscriptions(ends_at)")
    .order("created_at", { ascending: false })
    .limit(50);
  // PostgREST filtr sintaksisiga ta'sir qiladigan belgilarni olib tashlaymiz
  const safe = q.replace(/[,()*%\\]/g, " ").trim();
  if (safe) query = query.or(`full_name.ilike.*${safe}*,telegram_username.ilike.*${safe.replace(/^@/, "")}*`);
  const { data } = await query.returns<Row[]>();
  const now = serverNow();

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Foydalanuvchilar</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ism yoki @username"
          className="min-w-0 flex-1 rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-cyan" />
        <button className="btn-primary">Qidirish</button>
      </form>
      <ul className="card divide-y divide-line p-0!">
        {(data ?? []).map((u) => {
          const until = u.subscriptions.map((s) => Date.parse(s.ends_at)).filter((t) => t > now).sort().at(-1);
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{u.full_name || "Ismsiz"}</span>
                <span className="text-xs text-mute">
                  {u.telegram_username && `@${u.telegram_username} · `}{u.region ?? "hudud yo'q"}
                  {until && ` · Premium ${new Date(until).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })} gacha`}
                </span>
              </span>
              <form action={setRole} className="flex items-center gap-1.5">
                <input type="hidden" name="user" value={u.id} />
                <select name="role" defaultValue={u.role} aria-label="Rol" className="rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm font-semibold">
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button className="text-xs font-bold text-cyan-2">Saqlash</button>
              </form>
              <form action={grantPremium} className="flex items-center gap-1.5">
                <input type="hidden" name="user" value={u.id} />
                <select name="months" defaultValue="1" aria-label="Premium oy" className="rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm font-semibold">
                  {[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} oy</option>)}
                </select>
                <button className="text-xs font-bold text-cyan-2">+ Premium</button>
              </form>
            </li>
          );
        })}
        {!data?.length && <li className="px-5 py-4 text-sm text-mute">Topilmadi.</li>}
      </ul>
    </div>
  );
}
