import { NextResponse, type NextRequest } from "next/server";
import { handleUpdate, type Update } from "@/lib/bot/handler";
import { botApi, botDeps } from "@/lib/bot/server";
import { botEnv } from "@/lib/env";
import { secretEquals } from "@/lib/secure-compare";

/** Telegram webhook. Faqat setWebhook'da berilgan secret_token bilan kelgan so'rovlar qabul qilinadi. */
export async function POST(request: NextRequest) {
  const cfg = botEnv();
  const api = botApi();
  if (!cfg || !api) return new NextResponse("bot sozlanmagan", { status: 503 });
  if (!secretEquals(request.headers.get("x-telegram-bot-api-secret-token"), cfg.TELEGRAM_WEBHOOK_SECRET)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }

  try {
    await handleUpdate(update, botDeps(api));
  } catch (e) {
    // Telegram 200 olmasa bir xil yangilanishni qayta-qayta yuboradi — xatoni loglab, 200 qaytaramiz
    console.error("bot update", update.update_id, (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
