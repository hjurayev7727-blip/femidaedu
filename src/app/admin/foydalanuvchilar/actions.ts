"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

const ROLES = ["student", "teacher", "author", "reviewer", "admin"] as const;

export async function setRole(form: FormData) {
  const { userId } = await requireRole("admin");
  const user = z.uuid().parse(form.get("user"));
  const role = z.enum(ROLES).parse(form.get("role"));
  // admin_set_role ichida ham admin tekshiriladi; o'zini admin'likdan tushira olmaydi
  await createSupabaseAdmin().rpc("admin_set_role", { p_admin: userId, p_user: user, p_role: role });
  revalidatePath("/admin/foydalanuvchilar");
}

export async function grantPremium(form: FormData) {
  const { userId } = await requireRole("admin");
  const user = z.uuid().parse(form.get("user"));
  const months = z.coerce.number().int().min(1).max(24).parse(form.get("months"));
  await createSupabaseAdmin().rpc("admin_grant_premium", { p_admin: userId, p_user: user, p_months: months });
  revalidatePath("/admin/foydalanuvchilar");
}

export async function setGroupPremium(form: FormData) {
  const { userId } = await requireRole("admin");
  const group = z.coerce.number().int().positive().parse(form.get("group"));
  await createSupabaseAdmin().rpc("admin_set_group_premium", { p_admin: userId, p_group: group, p_on: form.get("on") === "1" });
  revalidatePath("/admin/guruhlar");
}
