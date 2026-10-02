import type { Metadata } from "next";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { z } from "zod";
import { LiveHost } from "@/components/live/host";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { liveLinks } from "@/lib/live";
import { liveState } from "@/lib/live-server";
import { hostControl } from "../../actions";

export const metadata: Metadata = { title: "Jonli viktorina — boshqaruv", robots: { index: false } };

export default async function HostPage({ params }: PageProps<"/jonli/host/[room]">) {
  const { room } = await params;
  if (!z.uuid().safeParse(room).success) notFound();
  const { supabase } = await requireUser();
  const s = await liveState(room, true);
  if (!s.ok) notFound();
  const { data: r } = await supabase.from("live_rooms").select("test_id").eq("id", room).maybeSingle<{ test_id: number }>();
  const { NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME } = env();
  const links = liveLinks(s.pin, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null);
  const qrSvg = await QRCode.toString(links.telegram ?? links.web, { type: "svg", margin: 1, color: { dark: "#0e2340", light: "#ffffff" } });
  return (
    <LiveHost roomId={room} initial={s} qrSvg={qrSvg} joinUrl={links.web} telegramUrl={links.telegram}
      control={hostControl} editorHref={r ? `/app/testlar/${r.test_id}` : "/app/testlar"} />
  );
}
