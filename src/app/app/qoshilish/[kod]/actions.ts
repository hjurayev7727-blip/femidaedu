"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function joinGroup(form: FormData) {
  const { userId } = await requireUser();
  const code = z.string().regex(/^[a-f0-9]{6,32}$/).safeParse(form.get("code"));
  if (!code.success) redirect("/app");
  const { data } = await createSupabaseAdmin().rpc("join_group", { p_user: userId, p_code: code.data });
  const r = data as { ok: boolean; reason?: string } | null;
  redirect(r?.ok ? "/app?guruh=ok" : `/app/qoshilish/${code.data}?xato=${r?.reason ?? "server"}`);
}
