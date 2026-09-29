import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { startReview } from "../mashq/actions";

export const metadata: Metadata = { title: "Takrorlash" };

const BOX_LABEL = ["", "Yangi xato", "3 kunlik", "7 kunlik", "14 kunlik", "30 kunlik"];

export default async function ReviewHome({ searchParams }: PageProps<"/app/takrorlash">) {
  const { supabase, profile } = await requireUser();
  const sp = await searchParams;
  const [{ data: due }, { data: boxes }] = await Promise.all([
    supabase.rpc("my_review_due"),
    supabase.from("review_queue").select("box").eq("user_id", profile.id).returns<{ box: number }[]>(),
  ]);
  const dueCount = Number(due ?? 0);
  const byBox = [1, 2, 3, 4, 5].map((b) => (boxes ?? []).filter((x) => x.box === b).length);
  const total = byBox.reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Xatolar ustida ishlash</h1>
        <p className="mt-1 text-mute">
          Xato qilgan savolingiz 1 → 3 → 7 → 14 → 30 kun oralig&apos;ida qayta beriladi. To&apos;g&apos;ri javob keyingi bosqichga
          o&apos;tkazadi, xato — boshiga qaytaradi.
        </p>
        {sp.xato === "bosh" && (
          <p role="status" className="mt-3 rounded-xl bg-ok-soft px-4 py-3 text-sm font-semibold text-ok">
            Bugun takrorlanadigan savol qolmadi 🎉
          </p>
        )}
      </div>

      <div className="card text-center">
        <p className="text-5xl font-extrabold tabular-nums">{dueCount}</p>
        <p className="mt-1 font-bold text-mute">ta savol bugun takrorlanishi kerak</p>
        {dueCount > 0 ? (
          <form action={startReview} className="mt-5">
            <button className="btn-primary">Takrorlashni boshlash ({Math.min(dueCount, 10)} ta)</button>
          </form>
        ) : (
          <Link href="/app/mashq" className="btn-ghost mt-5">Yangi mavzu mashq qilish</Link>
        )}
      </div>

      {total > 0 && (
        <div className="card">
          <p className="font-extrabold">Navbatdagi savollar: {total}</p>
          <ul className="mt-3 grid grid-cols-5 gap-2 text-center">
            {byBox.map((n, i) => (
              <li key={i} className="rounded-xl bg-bg py-2.5">
                <p className="text-xl font-extrabold tabular-nums">{n}</p>
                <p className="text-[11px] font-bold text-mute">{BOX_LABEL[i + 1]}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
