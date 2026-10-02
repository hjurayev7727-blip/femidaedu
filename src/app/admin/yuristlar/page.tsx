import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { licenseSignedUrl } from "@/lib/lawyers-server";
import { lawyersEnabled } from "@/lib/legal-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { assignRequest, handleReport, reviewVerification, setLawyerStatus, toggleLawyers } from "./actions";

export const metadata: Metadata = { title: "Yuristlar" };

type Queue = {
  verifications: { id: number; lawyer_id: string; name: string; license_no: string; doc_path: string; created_at: string }[];
  reports: { id: number; lawyer_id: string; name: string; status: string; reason: string; created_at: string; open_reports: number }[];
  blocked: { lawyer_id: string; name: string }[];
};

export default async function AdminLawyers() {
  const { userId } = await requireRole("admin");
  const admin = createSupabaseAdmin();
  const [{ data }, enabled, { data: un }, { data: active }] = await Promise.all([
    admin.rpc("lawyer_admin_queue", { p_admin: userId }), lawyersEnabled(), admin.rpc("unrouted_requests", { p_admin: userId }),
    admin.from("lawyer_profiles").select("user_id, display_name, fields").eq("status", "active").order("display_name").limit(500)
      .returns<{ user_id: string; display_name: string; fields: string[] }[]>(),
  ]);
  const unrouted = (un ?? []) as { id: number; title: string; body: string; field: string | null; region: string | null; created_at: string }[];
  const q = (data ?? { verifications: [], reports: [], blocked: [] }) as Queue;
  const urls = await Promise.all(q.verifications.map((v) => licenseSignedUrl(v.doc_path)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight">Yuristlar</h1>
        <form action={toggleLawyers} className="flex items-center gap-3">
          <span className={`text-sm font-bold ${enabled ? "text-ok" : "text-mute"}`}>Bo&apos;lim foydalanuvchilarga {enabled ? "ochiq" : "yopiq"}</span>
          <input type="hidden" name="on" value={enabled ? "0" : "1"} />
          <button className={enabled ? "btn-ghost" : "btn-primary"}>{enabled ? "Yopish" : "Ochish"}</button>
        </form>
      </div>

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Tasdiqlash navbati ({q.verifications.length})</h2>
        {q.verifications.length === 0 && <p className="px-5 py-4 text-mute">Navbat bo&apos;sh.</p>}
        <ul className="divide-y divide-line">
          {q.verifications.map((v, i) => (
            <li key={v.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><Link href={`/app/yuristlar/${v.lawyer_id}`} className="font-bold hover:underline">{v.name}</Link> · guvohnoma <b>{v.license_no}</b></span>
                <span className="text-xs text-mute">{fmtUz(v.created_at, { time: true })}</span>
              </div>
              {urls[i] && <a href={urls[i]!} target="_blank" rel="noreferrer" className="text-sm font-bold text-brand-2 hover:underline">📎 Hujjatni ochish (10 daqiqa)</a>}
              <form action={reviewVerification} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={v.id} />
                <input name="reason" maxLength={500} placeholder="Rad etish sababi" className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-1.5 text-sm" />
                <button name="decision" value="approve" className="btn-primary !py-1.5 !text-sm">Tasdiqlash</button>
                <button name="decision" value="reject" className="btn-ghost !py-1.5 !text-sm">Rad etish</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Ochiq shikoyatlar ({q.reports.length})</h2>
        {q.reports.length === 0 && <p className="px-5 py-4 text-mute">Shikoyat yo&apos;q.</p>}
        <ul className="divide-y divide-line">
          {q.reports.map((r) => (
            <li key={r.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><Link href={`/app/yuristlar/${r.lawyer_id}`} className="font-bold hover:underline">{r.name}</Link>
                  {r.open_reports > 1 && <span className="ml-2 rounded-md bg-no-soft px-2 py-0.5 text-xs font-bold text-no">{r.open_reports} ta shikoyat</span>}
                  {r.status === "blocked" && <span className="ml-2 text-xs font-bold text-no">bloklangan</span>}</span>
                <span className="text-xs text-mute">{fmtUz(r.created_at, { time: true })}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.reason}</p>
              <div className="flex flex-wrap gap-2">
                <form action={handleReport}><input type="hidden" name="id" value={r.id} /><button name="status" value="resolved" className="btn-ghost !py-1.5 !text-sm">Hal qilindi</button></form>
                <form action={handleReport}><input type="hidden" name="id" value={r.id} /><button name="status" value="dismissed" className="btn-ghost !py-1.5 !text-sm">Asossiz</button></form>
                {r.status !== "blocked" && (
                  <form action={setLawyerStatus}><input type="hidden" name="lawyer" value={r.lawyer_id} /><button name="status" value="blocked" className="btn-ghost !py-1.5 !text-sm text-no">Bloklash</button></form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card !p-0">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Yo&apos;naltirilmagan arizalar ({unrouted.length})</h2>
        {unrouted.length === 0 && <p className="px-5 py-4 text-mute">Hammasi yuristlarga yetib bordi.</p>}
        <ul className="divide-y divide-line">
          {unrouted.map((r) => (
            <li key={r.id} className="space-y-2 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <b>{r.title}</b>
                <span className="text-xs text-mute">{[r.field, r.region].filter(Boolean).join(" · ")} · {fmtUz(r.created_at, { time: true })}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{r.body}</p>
              <form action={assignRequest} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={r.id} />
                <select name="lawyer" required className="min-w-0 flex-1 rounded-xl border-2 border-line px-3 py-1.5 text-sm">
                  <option value="">Yuristni tanlang…</option>
                  {(active ?? []).map((l) => <option key={l.user_id} value={l.user_id}>{l.display_name} ({l.fields.join(", ")})</option>)}
                </select>
                <button className="btn-primary !py-1.5 !text-sm">Yo&apos;naltirish</button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      {q.blocked.length > 0 && (
        <section className="card !p-0">
          <h2 className="border-b border-line px-5 py-4 font-extrabold">Bloklanganlar</h2>
          <ul className="divide-y divide-line">
            {q.blocked.map((b) => (
              <li key={b.lawyer_id} className="flex items-center justify-between px-5 py-3">
                <Link href={`/app/yuristlar/${b.lawyer_id}`} className="font-bold hover:underline">{b.name}</Link>
                <form action={setLawyerStatus}><input type="hidden" name="lawyer" value={b.lawyer_id} /><button name="status" value="active" className="btn-ghost !py-1.5 !text-sm">Blokdan chiqarish</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
