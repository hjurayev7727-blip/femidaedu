"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { esc } from "@/lib/bot/api";
import { broadcast } from "@/lib/bot/broadcast";
import { openApp } from "@/lib/bot/handler";
import { botApi } from "@/lib/bot/server";
import { requireRole } from "@/lib/auth";
import { fmtWhen } from "@/lib/dates";
import { env } from "@/lib/env";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const Input = z.object({
  title: z.string().trim().min(3).max(80),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.coerce.number().int().min(5).max(180),
  count: z.coerce.number().int().min(5).max(50),
  topic: z.string().regex(/^[a-z0-9-]{0,80}$/),
  premium: z.boolean(),
  announce: z.boolean(),
});

export async function createContest(form: FormData) {
  await requireRole("admin");
  const parsed = Input.safeParse({
    title: form.get("title"),
    date: form.get("date"),
    time: form.get("time"),
    duration: form.get("duration"),
    count: form.get("count"),
    topic: form.get("topic") ?? "",
    premium: form.get("premium") === "on",
    announce: form.get("announce") === "on",
  });
  if (!parsed.success) redirect(`/admin/musobaqalar?xato=${encodeURIComponent(parsed.error.issues[0]?.message ?? "forma")}`);
  const d = parsed.data;
  const admin = createSupabaseAdmin();

  const startsAt = new Date(`${d.date}T${d.time}:00+05:00`); // Toshkent vaqti
  const endsAt = new Date(startsAt.getTime() + d.duration * 60_000);
  let topicId: number | null = null;
  if (d.topic) {
    const { data: t } = await admin.from("topics").select("id").eq("slug", d.topic).maybeSingle<{ id: number }>();
    topicId = t?.id ?? null;
  }
  const { data: ids } = await admin.rpc("contest_pick", { p_n: d.count, p_topic: topicId });
  if (!(ids as number[] | null)?.length) redirect("/admin/musobaqalar?xato=savol");

  const { data: c, error } = await admin
    .from("contests")
    .insert({ title: d.title, question_ids: ids, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), is_premium: d.premium, topic_id: topicId })
    .select("id")
    .single<{ id: number }>();
  if (error || !c) redirect("/admin/musobaqalar?xato=server");

  let sent = 0;
  const api = botApi();
  if (d.announce && api) {
    const { data: rec } = await admin.from("profiles").select("telegram_id").eq("bot_enabled", true).not("telegram_id", "is", null)
      .returns<{ telegram_id: number }[]>();
    const site = env().NEXT_PUBLIC_SITE_URL;
    const res = await broadcast(api, (rec ?? []).map((r) => ({ telegram_id: Number(r.telegram_id) })), () => ({
      html: `🏁 <b>Yangi musobaqa: ${esc(d.title)}</b>\n\n🗓 ${esc(fmtWhen(startsAt.toISOString()))}, ${d.duration} daqiqa · ${ids!.length} savol${d.premium ? " · Premium" : ""}\nG'oliblar nishon oladi 🥇`,
      opts: { reply_markup: { inline_keyboard: openApp(site, "Batafsil", `/app/musobaqa/${c.id}`) } },
    }));
    sent = res.sent;
    if (res.blocked.length) await admin.from("profiles").update({ bot_enabled: false }).in("telegram_id", res.blocked);
  }
  revalidatePath("/admin/musobaqalar");
  redirect(`/admin/musobaqalar?yaratildi=${c.id}&yuborildi=${sent}`);
}
