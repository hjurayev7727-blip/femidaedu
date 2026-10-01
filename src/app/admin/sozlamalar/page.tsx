import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import type { ManualPaymentSettings, Plan } from "@/lib/payments";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { LawyersToggleForm, PaymentSettingsForm, PlanForm } from "./forms";

export const metadata: Metadata = { title: "Sozlamalar" };

export default async function AdminSettings() {
  await requireRole("admin");
  const admin = createSupabaseAdmin();
  const [{ data: plans }, { data: pay }, { data: lawyers }] = await Promise.all([
    admin.from("plans").select("code, title, months, price_uzs, sort, is_active").order("sort").returns<Plan[]>(),
    admin.from("app_settings").select("value").eq("key", "manual_payment").maybeSingle<{ value: ManualPaymentSettings }>(),
    admin.from("app_settings").select("value").eq("key", "lawyers_enabled").maybeSingle<{ value: unknown }>(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Sozlamalar</h1>

      <section className="card p-0!">
        <h2 className="border-b border-line px-5 py-4 font-extrabold">Premium tariflari</h2>
        <div className="divide-y divide-line">
          {(plans ?? []).map((p) => <PlanForm key={p.code} plan={p} />)}
        </div>
        <p className="border-t border-line px-5 py-3 text-xs text-mute">
          Narx o&apos;zgarishi faqat yangi to&apos;lovlarga ta&apos;sir qiladi. Boshlang&apos;ich narxlar: 49 000 / 129 000.
        </p>
      </section>

      <PaymentSettingsForm value={pay?.value ?? { card: "", holder: "", note: "" }} />

      <LawyersToggleForm enabled={lawyers?.value === true} />
    </div>
  );
}
