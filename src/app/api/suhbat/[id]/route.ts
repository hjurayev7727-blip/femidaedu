import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { chatPoll } from "@/lib/chat-server";

export const dynamic = "force-dynamic";

/** Yozishma holati (polling): ?after=<oxirgi xabar id> */
export async function GET(request: Request, ctx: RouteContext<"/api/suhbat/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ ok: false, reason: "not_found" }, { status: 404 });
  const { userId } = await requireUser();
  const after = z.coerce.number().int().min(0).catch(0).parse(new URL(request.url).searchParams.get("after"));
  const state = await chatPoll(userId, id, after);
  return NextResponse.json(state, { status: state.ok ? 200 : 404, headers: { "Cache-Control": "no-store" } });
}
