import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { tashkentMonthStart } from "@/lib/dates";
import { FREE_MONTHLY_MOCKS, getTemplate } from "@/lib/mock-server";
import { startMockExam } from "./actions";

export const metadata: Metadata = { title: "Milliy sertifikat: sinov imtihoni" };

const ERRORS: Record<string, string> = {
  limit: `Bepul tarifda oyiga ${FREE_MONTHLY_MOCKS} ta sinov. Keyingisi kelasi oy ochiladi yoki Premium bilan cheksiz.`,
  questions: "Savollar bazasi sinov uchun yetarli emas (administratorga xabar bering).",
  template: "Sinov shabloni topilmadi.",
  server: "Sinovni boshlab bo'lmadi. Qayta urinib ko'ring.",
};

type Row = { id: string; started_at: string; finished_at: string | null; deadline_at: string; scaled_score: number | null; grade: string | null };

export default async function MockHome({ searchParams }: PageProps<"/app/imtihon">) {
  const { supabase, profile } = await requireUser();
  const sp = await searchParams;
  const [template, { data: history }, { data: premium }] = await Promise.all([
    getTemplate(),
    supabase
      .from("attempts")
      .select("id, started_at, finished_at, deadline_at, scaled_score, grade")
      .eq("user_id", profile.id)
      .eq("mode", "mock")
      .order("started_at", { ascending: false })
      .limit(20)
      .returns<Row[]>(),
    supabase.rpc("is_premium"),
  ]);

  const rows = history ?? [];
  const monthStart = tashkentMonthStart();
  const usedThisMonth = rows.filter((r) => Date.parse(r.started_at) >= monthStart).length;
  const open = rows.find((r) => !r.finished_at);
  const canStart = Boolean(premium) || usedThisMonth < FREE_MONTHLY_MOCKS || Boolean(open);
  const error = ERRORS[String(sp.xato ?? "")];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Sinov imtihoni</h1>
        <p className="mt-1 text-mute">Milliy sertifikat formatida — natija 75 ballik shkalada va A+ … C darajada.</p>
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-no-soft px-4 py-3 text-sm font-semibold text-no">
            {error}{" "}
            {sp.xato === "limit" && <Link href="/app/premium" className="underline">Premium haqida →</Link>}
          </p>
        )}
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <Fact value="45" label="topshiriq" />
          <Fact value={`${template?.duration_min ?? 90}`} label="daqiqa" />
          <Fact value="75" label="maks. ball" />
        </div>
        <ul className="space-y-1.5 text-[15px]">
          <li>• <b>1–32</b> — yopiq testlar (bitta javob, moslashtirish, tartiblash, amaliy vaziyat)</li>
          <li>• <b>33–35</b> — bo&apos;sh joyni to&apos;ldirish</li>
          <li>• <b>36–45</b> — yozma javob, har biri a) va b) qismdan</li>
          <li>• Ball qiyinlikka bog&apos;liq: 1,3 / 2,2 / 3,2 (yopiq), 1,1 / 1,5 / 1,7 (yozma qism)</li>
        </ul>
        <p className="rounded-xl bg-amber-soft px-4 py-3 text-sm">
          Huquq fanidan rasmiy sertifikat spetsifikatsiyasi hali e&apos;lon qilinmagan — sinov boshqa fanlardagi amaldagi
          formatga asoslangan. Rasmiy format chiqqach, shablon yangilanadi.
        </p>
        {open ? (
          <Link href={`/app/imtihon/${open.id}`} className="btn-primary w-full">Boshlangan sinovni davom ettirish →</Link>
        ) : (
          <form action={startMockExam}>
            <button className="btn-primary w-full" disabled={!canStart}>Sinovni boshlash</button>
          </form>
        )}
        {!premium && (
          <p className="text-center text-xs text-mute">
            Bepul tarif: oyiga {FREE_MONTHLY_MOCKS} ta sinov · bu oy: {Math.min(usedThisMonth, FREE_MONTHLY_MOCKS)}/{FREE_MONTHLY_MOCKS} ·{" "}
            <Link href="/app/premium" className="font-bold text-brand-2 underline-offset-2 hover:underline">Premium — cheksiz</Link>
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-extrabold tracking-tight">Natijalarim</h2>
          <ul className="card divide-y divide-line p-0!">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/app/imtihon/${r.id}${r.finished_at ? "/natija" : ""}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg">
                  <span className={`w-12 rounded-lg py-1 text-center font-extrabold ${r.grade ? "bg-accent text-white" : "bg-bg text-mute"}`}>
                    {r.finished_at ? (r.grade ?? "—") : "…"}
                  </span>
                  <span className="flex-1 text-sm">
                    {new Date(r.started_at).toLocaleDateString("uz-UZ", { timeZone: "Asia/Tashkent", day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="font-bold tabular-nums">{r.finished_at ? `${Number(r.scaled_score)} / 75` : "davom etmoqda"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-bg py-3">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-bold text-mute">{label}</p>
    </div>
  );
}
