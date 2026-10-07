import { NextResponse, type NextRequest } from "next/server";
import { communityTip } from "@/lib/ai";
import { aiClient, logUsage } from "@/lib/ai-server";
import { fallbackTip, hamjamiyatChatId, postDailyTip, type DailyTip } from "@/lib/bot/hamjamiyat";
import { botApi, botUsername } from "@/lib/bot/server";
import { cronSecret } from "@/lib/env";
import { secretEquals } from "@/lib/secure-compare";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const maxDuration = 120;

type ArticleRow = { number: string; title: string | null; body: string; documents: { short_title: string | null } | null };

/** Kun moddasi: sana bo'yicha tanlangan amaldagi modda → AI saboqcha; baza/AI ishlamasa — tayyor saboqcha */
async function dailyTip(day: string): Promise<DailyTip> {
  const admin = createSupabaseAdmin();
  const c = aiClient();
  const { count } = await admin.from("articles").select("id", { count: "exact", head: true }).neq("status", "repealed");
  if (!c || !count) return fallbackTip(day);
  const k = Math.floor(Date.parse(day) / 86_400_000) * 7919 % count;
  const { data: a } = await admin.from("articles").select("number, title, body, documents(short_title)").neq("status", "repealed")
    .order("id").range(k, k).maybeSingle<ArticleRow>();
  if (!a?.documents?.short_title || a.body.length < 80) return fallbackTip(day);
  const ref = `${a.documents.short_title} ${a.number}-modda`;
  const r = await communityTip(c, { ref, title: a.title, body: a.body });
  if (!r.ok || !r.data.text.trim()) return fallbackTip(day);
  await logUsage(null, "community_tip", r.usage).catch(() => {});
  return { text: r.data.text, source: ref };
}

/** Vercel Cron: har kuni 13:00 UTC (18:00 Toshkent) — hamjamiyat guruhiga bitta saboqcha. vercel.json */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  const api = botApi();
  if (!secret || !api) return new NextResponse("sozlanmagan", { status: 503 });
  if (!secretEquals(request.headers.get("authorization")?.replace(/^Bearer /, ""), secret)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const admin = createSupabaseAdmin();
  const chatId = hamjamiyatChatId();
  const result = await postDailyTip({
    api,
    chatId,
    username: botUsername(),
    now: new Date(),
    async claim(day) {
      const { data, error } = await admin.from("community_posts").upsert({ chat_id: chatId, day }, { onConflict: "chat_id,day", ignoreDuplicates: true }).select("day");
      if (error) throw new Error(`community_posts: ${error.message}`);
      return (data?.length ?? 0) > 0;
    },
    async release(day) {
      await admin.from("community_posts").delete().eq("chat_id", chatId).eq("day", day);
    },
    tip: dailyTip,
  });
  return NextResponse.json({ result });
}
