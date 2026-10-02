import type { Metadata } from "next";
import Link from "next/link";
import { CreateTestForm, type ChapterOption, type DocOption } from "@/components/tests/create-form";
import { aiEnabled } from "@/lib/ai-server";
import { requireUser } from "@/lib/auth";
import { FREE_MAX_ITEMS, MAX_ITEMS } from "@/lib/user-tests";
import { createTest } from "../actions";

export const metadata: Metadata = { title: "Yangi test" };
// AI generatsiya (bir nechta bo'lak parallel) uchun
export const maxDuration = 300;

export default async function NewTestPage({ searchParams }: PageProps<"/app/testlar/yangi">) {
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const [{ data: docs }, { data: chapters }, { data: premium }] = await Promise.all([
    supabase.from("documents").select("id, short_title, fields(title)").not("field_id", "is", null).order("id")
      .returns<{ id: number; short_title: string; fields: { title: string } | null }[]>(),
    supabase.from("chapters").select("id, document_id, number, title").order("sort").returns<ChapterOption[]>(),
    supabase.rpc("is_premium"),
  ]);
  const documents: DocOption[] = (docs ?? []).map((d) => ({ id: d.id, short_title: d.short_title, field: d.fields?.title ?? null }));
  const docId = Number(sp.hujjat);
  const articles = typeof sp.moddalar === "string" ? sp.moddalar.slice(0, 200) : undefined;
  const doc = documents.find((d) => d.id === docId);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <nav className="text-sm font-semibold text-mute"><Link href="/app/testlar" className="hover:underline">Testlar</Link> › Yangi test</nav>
      <h1 className="text-3xl font-bold">AI bilan test yaratish</h1>
      <CreateTestForm
        action={createTest}
        documents={documents}
        chapters={chapters ?? []}
        maxItems={premium ? MAX_ITEMS : FREE_MAX_ITEMS}
        premium={Boolean(premium)}
        initial={{ document: doc?.id, articles, title: doc && articles ? `${doc.short_title}: ${articles}-modda` : undefined }}
        aiReady={aiEnabled()}
      />
    </div>
  );
}
