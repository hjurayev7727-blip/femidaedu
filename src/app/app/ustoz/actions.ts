"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth";

// Barcha yozuvlar o'qituvchining o'z klienti orqali — RLS guruh egaligini tekshiradi.

export async function createGroup(form: FormData) {
  const { supabase, userId } = await requireRole("teacher", "admin");
  const name = z.string().trim().min(2).max(60).safeParse(form.get("name"));
  if (!name.success) redirect("/app/ustoz?xato=nom");
  const { data, error } = await supabase.from("groups").insert({ teacher_id: userId, name: name.data }).select("id").single<{ id: number }>();
  if (error || !data) redirect("/app/ustoz?xato=server");
  redirect(`/app/ustoz/${data.id}`);
}

export async function removeMember(form: FormData) {
  const { supabase } = await requireRole("teacher", "admin");
  const groupId = z.coerce.number().int().positive().parse(form.get("group"));
  const userId = z.uuid().parse(form.get("user"));
  await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  revalidatePath(`/app/ustoz/${groupId}`);
}

const AssignmentInput = z.object({
  group: z.coerce.number().int().positive(),
  title: z.string().trim().min(2, "Vazifa nomini yozing").max(100),
  topic: z.string().regex(/^[a-z0-9-]{1,80}$/, "Mavzuni tanlang"),
  count: z.coerce.number().int().min(5).max(50),
  due: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export async function createAssignment(form: FormData) {
  const { supabase } = await requireRole("teacher", "admin");
  const input = AssignmentInput.safeParse({
    group: form.get("group"),
    title: form.get("title"),
    topic: form.get("topic"),
    count: form.get("count"),
    due: form.get("due") ?? "",
  });
  const groupId = Number(form.get("group"));
  if (!input.success) redirect(`/app/ustoz/${groupId}?xato=${encodeURIComponent(input.error.issues[0]?.message ?? "vazifa")}`);
  const { data: topic } = await supabase.from("topics").select("id").eq("slug", input.data.topic).maybeSingle<{ id: number }>();
  if (!topic) redirect(`/app/ustoz/${groupId}?xato=mavzu`);
  const { error } = await supabase.from("assignments").insert({
    group_id: input.data.group,
    title: input.data.title,
    mode: "assignment",
    topic_id: topic.id,
    question_count: input.data.count,
    // muddat — tanlangan kunning oxiri (Toshkent vaqti)
    due_at: input.data.due ? `${input.data.due}T23:59:59+05:00` : null,
  });
  if (error) redirect(`/app/ustoz/${groupId}?xato=server`);
  revalidatePath(`/app/ustoz/${groupId}`);
}

export async function deleteAssignment(form: FormData) {
  const { supabase } = await requireRole("teacher", "admin");
  const id = z.coerce.number().int().positive().parse(form.get("id"));
  const groupId = z.coerce.number().int().positive().parse(form.get("group"));
  await supabase.from("assignments").delete().eq("id", id);
  revalidatePath(`/app/ustoz/${groupId}`);
}

export async function regenerateInvite(form: FormData) {
  const { supabase } = await requireRole("teacher", "admin");
  const groupId = z.coerce.number().int().positive().parse(form.get("group"));
  // regenerate_invite egalikni tekshiradi va kodni tasodifiy yaratadi
  await supabase.rpc("regenerate_invite", { p_group: groupId });
  revalidatePath(`/app/ustoz/${groupId}`);
}
