"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { PRACTICE_SIZE } from "@/lib/practice";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const ERR: Record<string, string> = { premium_required: "premium", no_questions: "bosh", not_found: "topilmadi" };

/** Modda bo'yicha mashq — modda sahifasidagi tugma */
export async function startArticlePractice(form: FormData) {
  const { supabase, userId } = await requireUser();
  const article = z.coerce.number().int().positive().safeParse(form.get("article"));
  const back = z.string().regex(/^\/app\/sohalar\/[a-z0-9-]{1,40}\/\d{1,12}$/).safeParse(form.get("back"));
  if (!article.success || !back.success) redirect("/app/sohalar");

  const { data: premium } = await supabase.rpc("is_premium");
  const { data: attemptId, error } = await createSupabaseAdmin().rpc("start_article_practice", {
    p_user: userId,
    p_article: article.data,
    p_n: PRACTICE_SIZE,
    p_premium: Boolean(premium),
  });
  if (error) {
    const code = Object.keys(ERR).find((k) => error.message.includes(k));
    redirect(`${back.data}?xato=${code ? ERR[code] : "server"}`);
  }
  redirect(`/app/mashq/s/${attemptId as string}`);
}
