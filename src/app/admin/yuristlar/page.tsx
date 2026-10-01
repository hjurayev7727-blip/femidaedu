import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { fmtUz } from "@/lib/dates";
import { formatPhone, LAWYER_KIND, REPORT_KIND, type LawyerKind, type ReportKind } from "@/lib/lawyers";
import { licenseSignedUrl } from "@/lib/lawyers-server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { approveVerification, handleReport, rejectVerification, revokeVerification, setLawyerStatus } from "./actions";

export const metadata: Metadata = { title: "Yuristlar" };

type Pending = {
  id: number;
  user_id: string;
  license_no: string;
  doc_path: string;
  created_at: string;
  lawyer_profiles: { display_name: string; kind: LawyerKind; region: string } | null;
};
type Report = {
  id: number;
  lawyer_id: string;
  kind: ReportKind;
  reason: string;
  created_at: string;
  lawyer_profiles: { display_name: string; status: string } | null;
  profiles: { full_name: string; telegram_username: string | null } | null;
};
type Lawyer = {
  user_id: string;
  display_name: string;
  kind: LawyerKind;
  region: string;
  status: "active" | "hidden" | "blocked";
  verified_at: string | null;
  phone: string | null;
  telegram: string | null;
  created_at: string;
};

const small = "btn-ghost !px-3 !py-1.5 text-xs";
const STATUS_UZ = { active: "faol", hidden: "yashirin", blocked: "bloklangan" } as const;

function StatusButton({ lawyer, status, label, danger = false }: { lawyer: string; status: Lawyer["status"]; label: string; danger?: boolean }) {
  return (
    <form action={setLawyerStatus}>
      <input type="hidden" name="lawyer" value={lawyer} />
      <input type="hidden" name="status" value={status} />
      <button className={`${small} ${danger ? "!text-no" : ""}`}>{label}</button>
    </form>
  );
}

export default async function AdminLawyers() {
  await requireRole("admin");
  const admin = createSupabaseAdmin();
  const [{ data: pending }, { data: reports }, { data: lawyers }, { count: total }] = await Promise.all([
    admin.from("lawyer_verifications").select("id, user_id, license_no, doc_path, created_at, lawyer_profiles(display_name, kind, region)")
      .eq("status", "pending").order("created_at").returns<Pending[]>(),
    admin.from("lawyer_reports")
      .select("id, lawyer_id, kind, reason, created_at, lawyer_profiles(display_name, status), profiles!lawyer_reports_reporter_id_fkey(full_name, telegram_username)")
      .eq("status", "open").order("created_at").limit(100).returns<Report[]>(),
    admin.from("lawyer_profiles").select("user_id, display_name, kind, region, status, verified_at, phone, telegram, created_at")
      .order("created_at", { ascending: false }).limit(50).returns<Lawyer[]>(),
    admin.from("lawyer_profiles").select("user_id", { count: "exact", head: true }),
  ]);
  const urls = await Promise.all((pending ?? []).map((p) => licenseSignedUrl(p.doc_path)));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">Tasdiqlash navbati ({pending?.length ?? 0})</h1>
        <p className="mt-1 text-sm text-mute">Ism hujjatdagi bilan mos kelishini, hujjat haqiqiyligini (advokat — Advokatlar palatasi reestri) tekshiring. Ko&apos;rib chiqilgach fayl o&apos;chiriladi.</p>
        {!pending?.length && <p className="mt-3 text-mute">Hozircha yo&apos;q.</p>}
        <ul className="mt-4 space-y-4">
          {(pending ?? []).map((p, i) => (
            <li key={p.id} className="card grid gap-4 md:grid-cols-[1fr_240px]">
              <div className="space-y-2">
                <p className="font-extrabold">
                  <Link href={`/app/yuristlar/${p.user_id}`} className="hover:underline">{p.lawyer_profiles?.display_name ?? "—"}</Link>{" "}
                  <span className="font-semibold text-mute">· {p.lawyer_profiles ? LAWYER_KIND[p.lawyer_profiles.kind] : ""} · {p.lawyer_profiles?.region}</span>
                </p>
                <p className="text-sm">Raqam: <b className="font-mono">{p.license_no}</b> · {fmtUz(p.created_at)}</p>
                <div className="flex flex-wrap items-start gap-2 pt-2">
                  <form action={approveVerification}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn-primary !px-4 !py-2.5 text-sm">✓ Tasdiqlash</button>
                  </form>
                  <form action={rejectVerification} className="flex flex-1 gap-2">
                    <input type="hidden" name="id" value={p.id} />
                    <input name="reason" placeholder="Rad etish sababi (yuristga ko'rinadi)"
                      className="min-w-0 flex-1 rounded-xl border-2 border-line bg-card px-3 py-2 text-sm outline-none focus:border-brand" />
                    <button className="btn-ghost !px-3 !py-2 text-sm !text-no">Rad etish</button>
                  </form>
                </div>
              </div>
              {urls[i] ? (
                <a href={urls[i]!} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-line">
                  {p.doc_path.endsWith(".pdf") ? (
                    <span className="flex h-40 items-center justify-center bg-bg font-bold">📄 PDF hujjatni ochish</span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- vaqtinchalik imzolangan havola, optimizatsiya shart emas
                    <img src={urls[i]!} alt={`${p.lawyer_profiles?.display_name ?? "Yurist"} hujjati`} className="max-h-72 w-full object-contain" />
                  )}
                </a>
              ) : <span className="text-sm text-no">Fayl topilmadi</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-extrabold">Ochiq shikoyatlar ({reports?.length ?? 0})</h2>
        {!reports?.length && <p className="mt-3 text-mute">Hozircha yo&apos;q.</p>}
        <ul className="mt-3 space-y-3">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="card space-y-2">
              <p className="text-sm">
                <Link href={`/app/yuristlar/${r.lawyer_id}`} className="font-extrabold hover:underline">{r.lawyer_profiles?.display_name ?? "—"}</Link>
                {r.lawyer_profiles && r.lawyer_profiles.status !== "active" && <span className="text-mute"> ({STATUS_UZ[r.lawyer_profiles.status as Lawyer["status"]]})</span>}
                {" "}· <b className="text-no">{REPORT_KIND[r.kind]}</b> · {fmtUz(r.created_at)}
              </p>
              <p className="whitespace-pre-wrap text-sm">{r.reason}</p>
              <p className="text-xs text-mute">
                Shikoyatchi: {r.profiles?.full_name || "Ismsiz"}{r.profiles?.telegram_username && ` @${r.profiles.telegram_username}`}
              </p>
              <div className="flex flex-wrap gap-2">
                <form action={handleReport}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="resolved" /><button className={small}>Hal qilindi</button></form>
                <form action={handleReport}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="dismissed" /><button className={small}>Asossiz</button></form>
                {r.lawyer_profiles?.status !== "blocked" && <StatusButton lawyer={r.lawyer_id} status="blocked" label="Yuristni bloklash" danger />}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-extrabold">Yuristlar <span className="text-sm font-semibold text-mute">(jami {total ?? 0}, oxirgi 50 ta)</span></h2>
        <ul className="card mt-3 divide-y divide-line p-0!">
          {(lawyers ?? []).map((l) => (
            <li key={l.user_id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
              <span className="min-w-0">
                <Link href={`/app/yuristlar/${l.user_id}`} className="font-bold hover:underline">{l.display_name}</Link>
                <span className="text-mute"> · {LAWYER_KIND[l.kind]} · {l.region} · {fmtUz(l.created_at, { short: true, time: false })}</span>
                {l.verified_at && <b className="text-ok"> · ✓</b>}
                <span className="block text-xs text-mute">{[l.phone && formatPhone(l.phone), l.telegram && `@${l.telegram}`].filter(Boolean).join(" · ")}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-bold ${l.status === "blocked" ? "text-no" : l.status === "hidden" ? "text-mute" : "text-ok"}`}>{STATUS_UZ[l.status]}</span>
                {l.verified_at && (
                  <form action={revokeVerification}><input type="hidden" name="lawyer" value={l.user_id} /><button className={small}>Belgini olish</button></form>
                )}
                {l.status === "blocked"
                  ? <StatusButton lawyer={l.user_id} status="active" label="Blokdan chiqarish" />
                  : <StatusButton lawyer={l.user_id} status="blocked" label="Bloklash" danger />}
              </span>
            </li>
          ))}
          {!lawyers?.length && <li className="px-5 py-3 text-sm text-mute">Hali ro&apos;yxatdan o&apos;tgan yurist yo&apos;q</li>}
        </ul>
      </section>
    </div>
  );
}
