import { NextResponse, type NextRequest } from "next/server";
import { esc } from "@/lib/bot/api";
import { broadcast } from "@/lib/bot/broadcast";
import { openApp } from "@/lib/bot/handler";
import { botApi } from "@/lib/bot/server";
import { cronSecret, env } from "@/lib/env";
import { secretEquals } from "@/lib/secure-compare";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 300;

type Row = { telegram_id: number; full_name: string; streak_days: number; questions_today: number; review_due: number };

/** Vercel Cron: /api/cron/eslatma?slot=morning (08:00) | evening (20:00) — vercel.json */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  const api = botApi();
  if (!secret || !api) return new NextResponse("sozlanmagan", { status: 503 });
  if (!secretEquals(request.headers.get("authorization")?.replace(/^Bearer /, ""), secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const slot = request.nextUrl.searchParams.get("slot");
  if (slot !== "morning" && slot !== "evening") return new NextResponse("slot", { status: 400 });

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.rpc("bot_recipients", { p_slot: slot });
  if (error) return new NextResponse(error.message, { status: 500 });
  const site = env().NEXT_PUBLIC_SITE_URL;
  const first = (r: Row) => esc(r.full_name.split(" ")[0] || "do'st");

  const result = await broadcast(api, (data ?? []) as Row[], (r) =>
    slot === "morning"
      ? {
          html: `Xayrli tong, ${first(r)}! ☀️\n\nBugungi <b>kunlik test</b> tayyor — 10 ta savol, 5 daqiqa.${r.review_due ? `\n🔁 Takrorlash: ${r.review_due} ta savol kutmoqda.` : ""}`,
          opts: { reply_markup: { inline_keyboard: openApp(site, "📝 Kunlik test", "/api/kunlik") }, disable_notification: true },
        }
      : {
          html: r.streak_days > 0
            ? `🔥 ${first(r)}, <b>${r.streak_days} kunlik streak</b>ingiz xavf ostida!\n\nBugun ${r.questions_today}/10 savol — yana ${10 - r.questions_today} ta yeching.`
            : `${first(r)}, bugun hali ${r.questions_today}/10 savol. 10 ta savol yechsangiz — streak boshlanadi 🔥`,
          opts: { reply_markup: { inline_keyboard: openApp(site, "🎯 Mashq qilish", "/app/mashq") } },
        },
  );

  if (result.blocked.length) {
    await admin.from("profiles").update({ bot_enabled: false }).in("telegram_id", result.blocked);
  }
  return NextResponse.json({ slot, ...result, blocked: result.blocked.length });
}
