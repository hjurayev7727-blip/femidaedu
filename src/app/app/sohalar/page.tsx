import type { Metadata } from "next";
import { FieldsGrid, type FieldCard } from "@/components/fields/fields-grid";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Huquq sohalari" };

export default async function FieldsCatalog() {
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("field_overview");
  return <FieldsGrid fields={(data ?? []) as FieldCard[]} />;
}
