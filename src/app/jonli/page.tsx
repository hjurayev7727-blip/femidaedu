import type { Metadata } from "next";
import { JoinForm } from "@/components/live/join-form";
import { normalizePin } from "@/lib/live";
import { createSupabase } from "@/lib/supabase/server";
import { currentActor } from "@/lib/user-tests-server";
import { joinLive } from "./actions";

export const metadata: Metadata = { title: "Jonli viktorina", description: "PIN kiriting va jonli viktorinaga qo'shiling." };

export default async function JoinPage({ searchParams }: PageProps<"/jonli">) {
  const sp = await searchParams;
  const actor = await currentActor();
  let name = "";
  if (actor.userId) {
    const supabase = await createSupabase();
    const { data } = await supabase.from("profiles").select("full_name").eq("id", actor.userId).maybeSingle<{ full_name: string }>();
    name = data?.full_name ?? "";
  }
  return <JoinForm action={joinLive} pin={normalizePin(String(sp.pin ?? ""))} signedIn={Boolean(actor.userId)} name={name} />;
}
