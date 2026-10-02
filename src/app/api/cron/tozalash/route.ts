import { NextResponse, type NextRequest } from "next/server";
import { botApi } from "@/lib/bot/server";
import { ensureBotWebhook } from "@/lib/bot/setup";
import { botEnv, cronSecret, env } from "@/lib/env";
import { purgeOrphanLicenses } from "@/lib/lawyers-server";
import { purgeStaleUploads } from "@/lib/legal-server";
import { secretEquals } from "@/lib/secure-compare";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 120;

/**
 * Vercel Cron (kunlik) — vercel.json: tahlil qilinmay qolgan hujjat yuklamalari va arizaga aylanmagan guvohnoma fayllarini
 * o'chirish, muddati o'tgan escrow buyurtmalarini yakunlash.
 */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  if (!secret) return new NextResponse("sozlanmagan", { status: 503 });
  if (!secretEquals(request.headers.get("authorization")?.replace(/^Bearer /, ""), secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const [removed, licenses, { data: released }, bot] = await Promise.all([
    purgeStaleUploads(), purgeOrphanLicenses(), createSupabaseAdmin().rpc("release_due_orders"), checkBotWebhook(),
  ]);
  return NextResponse.json({ removed, licenses, released, bot });
}

/** Kunlik zaxira tekshiruv: webhook uzilib qolgan bo'lsa qayta ulaydi (instrumentation.ts bilan bir xil). */
async function checkBotWebhook(): Promise<string> {
  const cfg = botEnv();
  const api = botApi();
  const site = env().NEXT_PUBLIC_SITE_URL;
  if (!cfg || !api || !site.startsWith("https://")) return "sozlanmagan";
  return ensureBotWebhook(api, site, cfg.TELEGRAM_WEBHOOK_SECRET).catch((e: Error) => `xato: ${e.message}`);
}
