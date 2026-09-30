import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { LivePlayer } from "@/components/live/player";
import { liveState } from "@/lib/live-server";
import { answerLiveAction } from "../actions";

export const metadata: Metadata = { title: "Jonli viktorina", robots: { index: false } };

export default async function PlayerPage({ params }: PageProps<"/jonli/[room]">) {
  const { room } = await params;
  if (!z.uuid().safeParse(room).success) notFound();
  const s = await liveState(room, false);
  if (!s.ok) redirect("/jonli");
  return <LivePlayer roomId={room} initial={s} answer={answerLiveAction} />;
}
