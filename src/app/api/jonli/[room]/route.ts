import { NextResponse } from "next/server";
import { z } from "zod";
import { liveState } from "@/lib/live-server";

export const dynamic = "force-dynamic";

/** Jonli viktorina holati (har 1,5 soniyada so'raladi). ?host=1 — host ekrani */
export async function GET(request: Request, ctx: RouteContext<"/api/jonli/[room]">) {
  const { room } = await ctx.params;
  if (!z.uuid().safeParse(room).success) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const host = new URL(request.url).searchParams.get("host") === "1";
  const state = await liveState(room, host);
  return NextResponse.json(state, { headers: { "Cache-Control": "no-store" } });
}
