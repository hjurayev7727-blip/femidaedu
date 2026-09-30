import type { Metadata } from "next";
import { TutorChat } from "@/components/tutor/chat";
import { TutorHome, type ThreadRow, type WeakRow } from "@/components/tutor/tutor-home";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { TUTOR_FREE_WEEKLY, TUTOR_PREMIUM_WEEKLY } from "@/lib/tutor";
import { uzWeekStart } from "@/lib/user-tests";
import { ask, mistakesTest } from "./actions";

export const metadata: Metadata = { title: "AI ustoz" };
export const maxDuration = 300;

export default async function TutorPage({ searchParams }: PageProps<"/app/yordamchi">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireUser();
  const [{ data: threads }, { data: premium }, { data: week }, { data: plan }, { data: weak }] = await Promise.all([
    supabase.from("tutor_threads").select("id, mode, title, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(20).returns<ThreadRow[]>(),
    supabase.rpc("is_premium"),
    supabase.from("ai_weekly").select("tutor").eq("user_id", userId).eq("week", uzWeekStart()).maybeSingle<{ tutor: number }>(),
    supabase.from("study_plans").select("user_id").eq("user_id", userId).maybeSingle(),
    createSupabaseAdmin().rpc("weak_articles", { p_user: userId, p_limit: 10 }),
  ]);
  return (
    <TutorHome
      chat={<TutorChat threadId={null} mode="explain" messages={[]} ask={ask} aiReady={aiEnabled()} pickMode />}
      threads={threads ?? []}
      weak={(weak ?? []) as WeakRow[]}
      weekUsed={week?.tutor ?? 0}
      weekLimit={premium ? TUTOR_PREMIUM_WEEKLY : TUTOR_FREE_WEEKLY}
      premium={Boolean(premium)}
      hasPlan={Boolean(plan)}
      error={typeof sp.xato === "string" ? sp.xato.slice(0, 200) : undefined}
      mistakesAction={mistakesTest}
    />
  );
}
