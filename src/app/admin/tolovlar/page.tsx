import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { formatUzs, receiptSignedUrl } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { approvePayment, rejectPayment } from "./actions";

export const metadata: Metadata = { title: "To'lovlar" };

type Row = {
  id: number;
  user_id: string;
  amount_uzs: number;
  months: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  receipt_path: string | null;
  reject_reason: string | null;
  plan_code: string | null;
  profiles: { full_name: string; telegram_username: string | null } | null;
};

const fmt = (s: string) => new Date(s).toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default async function AdminPayments() {
  await requireRole("admin");
  const admin = createSupabaseAdmin();
  const select = "id, user_id, amount_uzs, months, status, created_at, paid_at, receipt_path, reject_reason, plan_code, profiles!payments_user_id_fkey(full_name, telegram_username)";
  const [{ data: pending }, { data: recent }] = await Promise.all([
    admin.from("payments").select(select).eq("status", "pending").order("created_at").returns<Row[]>(),
    admin.from("payments").select(select).neq("status", "pending").order("created_at", { ascending: false }).limit(30).returns<Row[]>(),
  ]);
  const urls = await Promise.all((pending ?? []).map((p) => (p.receipt_path ? receiptSignedUrl(p.receipt_path) : null)));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">Tekshirilmagan to&apos;lovlar ({pending?.length ?? 0})</h1>
        {!pending?.length && <p className="mt-3 text-mute">Hozircha yo&apos;q.</p>}
        <ul className="mt-4 space-y-4">
          {(pending ?? []).map((p, i) => (
            <li key={p.id} className="card grid gap-4 md:grid-cols-[1fr_240px]">
              <div className="space-y-2">
                <p className="font-extrabold">
                  {p.profiles?.full_name || "Ismsiz"}{" "}
                  {p.profiles?.telegram_username && <span className="font-semibold text-mute">@{p.profiles.telegram_username}</span>}
                </p>
                <p className="text-sm">
                  <b>{formatUzs(p.amount_uzs)}</b> · {p.months} oy ({p.plan_code}) · {fmt(p.created_at)}
                </p>
                <p className="text-xs text-mute">To&apos;lov #{p.id} · foydalanuvchi {p.user_id.slice(0, 8)}</p>
                <p className="text-xs text-mute">Chekdagi summa, sana va qabul qiluvchi kartani bank ilovasi bilan solishtiring.</p>
                <div className="flex flex-wrap items-start gap-2 pt-2">
                  <form action={approvePayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-primary px-4! py-2.5! text-sm!">✓ Tasdiqlash</button>
                  </form>
                  <form action={rejectPayment} className="flex flex-1 gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input
                      name="reason"
                      placeholder="Rad etish sababi (foydalanuvchiga ko'rinadi)"
                      className="min-w-0 flex-1 rounded-xl border-2 border-line bg-card px-3 py-2 text-sm outline-none focus:border-cyan"
                    />
                    <button className="btn-ghost px-3! py-2! text-sm! text-no!">Rad etish</button>
                  </form>
                </div>
              </div>
              {urls[i] ? (
                <a href={urls[i]!} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line">
                  {p.receipt_path?.endsWith(".pdf") ? (
                    <span className="flex h-40 items-center justify-center bg-bg font-bold">📄 PDF chekni ochish</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- vaqtinchalik imzolangan havola, optimizatsiya shart emas
                    <img src={urls[i]!} alt={`To'lov #${p.id} cheki`} className="max-h-72 w-full object-contain" />
                  )}
                </a>
              ) : (
                <span className="text-sm text-no">Chek topilmadi</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-extrabold">Oxirgi ko&apos;rib chiqilganlar</h2>
        <ul className="card mt-3 divide-y divide-line p-0!">
          {(recent ?? []).map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span>
                #{p.id} · {p.profiles?.full_name || "Ismsiz"} · {formatUzs(p.amount_uzs)} · {fmt(p.created_at)}
                {p.reject_reason && <span className="text-no"> — {p.reject_reason}</span>}
              </span>
              <span className={`font-bold ${p.status === "paid" ? "text-ok" : "text-no"}`}>{p.status === "paid" ? "tasdiqlangan" : p.status}</span>
            </li>
          ))}
          {!recent?.length && <li className="px-5 py-3 text-sm text-mute">Yo&apos;q</li>}
        </ul>
      </section>
    </div>
  );
}
