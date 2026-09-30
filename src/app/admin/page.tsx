import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  await requireRole("admin");
  const admin = createSupabaseAdmin();
  const head = { count: "exact" as const, head: true };
  const [users, pending, reports, questions, activeSubs] = (
    await Promise.all([
      admin.from("profiles").select("*", head),
      admin.from("payments").select("*", head).eq("status", "pending"),
      admin.from("reports").select("*", head).eq("status", "open"),
      admin.from("questions").select("*", head).eq("status", "published"),
      admin.from("subscriptions").select("*", head).gt("ends_at", new Date().toISOString()),
    ])
  ).map((r) => r.count ?? 0);

  const cards = [
    { label: "Foydalanuvchilar", value: users },
    { label: "Faol Premium obunalar", value: activeSubs },
    { label: "E'lon qilingan savollar", value: questions },
    { label: "Tekshirilmagan to'lovlar", value: pending, href: "/admin/tolovlar", alert: pending > 0 },
    { label: "Ochiq shikoyatlar", value: reports, alert: reports > 0 },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Admin panel</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const body = (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-mute">{c.label}</p>
              <p className={`mt-2 text-3xl font-extrabold tabular-nums ${c.alert ? "text-amber" : ""}`}>{c.value}</p>
            </>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="card hover:border-brand">{body}</Link>
          ) : (
            <div key={c.label} className="card">{body}</div>
          );
        })}
      </div>
    </div>
  );
}
