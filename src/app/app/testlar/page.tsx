import type { Metadata } from "next";
import { TestsHome, type GroupTest, type MyTest } from "@/components/tests/tests-home";
import { requireUser } from "@/lib/auth";
import { FREE_WEEKLY_TESTS, PREMIUM_WEEKLY_TESTS, uzWeekStart } from "@/lib/user-tests";
import { claimGuestAttempts } from "@/lib/user-tests-server";
import { openByCode } from "./actions";

export const metadata: Metadata = { title: "Testlar" };

export default async function TestsPage({ searchParams }: PageProps<"/app/testlar">) {
  const sp = await searchParams;
  const { supabase, userId } = await requireUser();
  await claimGuestAttempts(userId);
  const [{ data: tests }, { data: groupTests }, { data: premium }, { data: week }] = await Promise.all([
    supabase.from("tests").select("id, title, share_code, visibility, status, attempts_count, rating_sum, rating_n, created_at")
      .eq("owner_id", userId).neq("status", "removed").order("created_at", { ascending: false }).limit(100).returns<MyTest[]>(),
    supabase.rpc("my_group_tests"),
    supabase.rpc("is_premium"),
    supabase.from("ai_weekly").select("tests").eq("user_id", userId).eq("week", uzWeekStart()).maybeSingle<{ tests: number }>(),
  ]);
  const thisWeek = week?.tests ?? 0;

  return (
    <TestsHome
      tests={tests ?? []}
      groupTests={(groupTests ?? []) as GroupTest[]}
      weekUsed={thisWeek}
      weekLimit={premium ? PREMIUM_WEEKLY_TESTS : FREE_WEEKLY_TESTS}
      premium={Boolean(premium)}
      codeError={sp.xato === "kod"}
      openByCode={openByCode}
    />
  );
}
