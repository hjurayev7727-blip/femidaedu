import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { serverNow } from "@/lib/dates";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { grantPremium, setRole } from "./actions";

export const metadata: Metadata = { title: "Foydalanuvchilar" };

type Row = {
  id: string; full_name: string; telegram_username: string | null; role: string; region: string | null; created_at: string;
  subscriptions: { ends_at: string; source: string }[];
};

const SOURCE_LABEL: Record<string, string> = { payment: "to'lov", promo: "admin bergan", group: "guruh" };

const ROLE_LABEL: Record<string, string> = { student: "O'quvchi", teacher: "O'qituvchi", author: "Muallif", reviewer: "Ekspert", admin: "Admin" };

export default async function AdminUsers({ searchParams }: PageProps<"/admin/foydalanuvchilar">) {
  await requireRole("admin");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim().slice(0, 60);
  let query = createSupabaseAdmin()
    .from("profiles")
    .select("id, full_name, telegram_username, role, region, created_at, subscriptions(ends_at, source)")
    .order("created_at", { ascending: false })
    .limit(50);
  // PostgREST filtr sintaksisiga ta'sir qiladigan belgilarni olib tashlaymiz
  const safe = q.replace(/[,()*%\\]/g, " ").trim();
  if (safe) query = query.or(`full_name.ilike.*${safe}*,telegram_username.ilike.*${safe.replace(/^@/, "")}*`);
  const admin = createSupabaseAdmin();
  const nowIso = new Date(serverNow()).toISOString();
  const [{ data }, { count: total }, { data: active }] = await Promise.all([
    query.returns<Row[]>(),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("user_id").gt("ends_at", nowIso).lte("starts_at", nowIso).returns<{ user_id: string }[]>(),
  ]);
  const premiumCount = new Set((active ?? []).map((a) => a.user_id)).size;
  const now = serverNow();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Foydalanuvchilar</h1>
        <p className="text-sm text-mute">
          Jami <b className="text-ink">{total ?? 0}</b> · Premium <b className="text-ok">{premiumCount}</b> · Bepul{" "}
          <b className="text-ink">{Math.max(0, (total ?? 0) - premiumCount)}</b>
        </p>
      </div>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ism yoki @username"
          className="min-w-0 flex-1 rounded-xl border-2 border-line bg-card px-3.5 py-2.5 font-semibold outline-none focus:border-cyan" />
        <button className="btn-primary">Qidirish</button>
      </form>
      <ul className="card divide-y divide-line p-0!">
        {(data ?? []).map((u) => {
          const activeSubs = u.subscriptions.filter((s) => Date.parse(s.ends_at) > now);
          const until = activeSubs.map((s) => Date.parse(s.ends_at)).sort().at(-1);
          const sources = [...new Set(activeSubs.map((s) => SOURCE_LABEL[s.source] ?? s.source))].join(", ");
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{u.full_name || "Ismsiz"}</span>
                  {until ? (
                    <span className="rounded-md bg-ok-soft px-2 py-0.5 text-xs font-extrabold text-ok">
                      Premium ({sources}) · {new Date(until).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })} gacha
                    </span>
                  ) : (
                    <span className="rounded-md bg-bg px-2 py-0.5 text-xs font-extrabold text-mute">Bepul</span>
                  )}
                </span>
                <span className="text-xs text-mute">
                  {u.telegram_username && `@${u.telegram_username} · `}{u.region ?? "hudud yo'q"} · ro&apos;yxatdan:{" "}
                  {new Date(u.created_at).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent" })}
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
