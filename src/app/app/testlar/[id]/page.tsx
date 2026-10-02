import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EditorItem } from "@/components/tests/item-editor";
import { TestEditor, type EditorTest, type ResultRow } from "@/components/tests/test-editor";
import { requireUser } from "@/lib/auth";
import { env } from "@/lib/env";
import type { Answer, Payload, QuestionType } from "@/lib/questions";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { rowToInput, shareLinks, type TestSettings, type Visibility } from "@/lib/user-tests";
import { publish, removeItem, saveItem, saveMeta, setStatus } from "../actions";

export const metadata: Metadata = { title: "Test" };
// Ochiq katalog uchun AI moderatsiya
export const maxDuration = 60;

type TestRow = Omit<EditorTest, "field_slug"> & { owner_id: string; fields: { slug: string } | null };
type ItemRow = { id: number; type: QuestionType; stem: string; context: string | null; payload: Payload; answer: Answer; explanation: string | null; article_id: number | null; difficulty: 1 | 2 | 3; articles: { number: string; documents: { short_title: string } | null } | null };

export default async function TestEditorPage({ params, searchParams }: PageProps<"/app/testlar/[id]">) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const { supabase, userId } = await requireUser();

  // RLS: faqat o'z testi
  const { data: t } = await supabase.from("tests")
    .select("id, owner_id, title, description, share_code, visibility, status, group_id, settings, own_material, moderation, fields(slug)")
    .eq("id", id).neq("status", "removed").maybeSingle<TestRow>();
  if (!t || t.owner_id !== userId) notFound();

  // Savollar va javob kaliti — faqat egasiga, server orqali
  const admin = createSupabaseAdmin();
  const [{ data: items }, { data: stats }, { data: results }, { data: fields }, { data: groups }, { data: me }] = await Promise.all([
    admin.from("test_items").select("id, type, stem, context, payload, answer, explanation, article_id, difficulty, articles(number, documents(short_title))")
      .eq("test_id", id).eq("status", "active").order("pos").order("id").returns<ItemRow[]>(),
    admin.rpc("test_item_stats", { p_user: userId, p_test: id }),
    admin.rpc("test_results", { p_user: userId, p_test: id }),
    supabase.from("fields").select("slug, title").order("sort").returns<{ slug: string; title: string }[]>(),
    supabase.from("groups").select("id, name").eq("teacher_id", userId).order("created_at").returns<{ id: number; name: string }[]>(),
    supabase.from("profiles").select("trust_level").eq("id", userId).single<{ trust_level: number }>(),
  ]);
  const statById = new Map(((stats ?? []) as { item_id: number; answered: number; correct: number }[]).map((s) => [Number(s.item_id), s]));
  const editorItems: EditorItem[] = (items ?? []).map((i) => ({
    id: Number(i.id),
    input: rowToInput(i),
    article: i.articles ? `${i.articles.documents?.short_title ?? ""} ${i.articles.number}-modda`.trim() : null,
    stats: statById.get(Number(i.id)) ?? null,
  }));
  const { NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME } = env();
  const links = shareLinks(t.share_code, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_TELEGRAM_BOT_USERNAME ?? null);

  return (
    <TestEditor
      test={{ ...t, visibility: t.visibility as Visibility, settings: t.settings as Partial<TestSettings>, field_slug: t.fields?.slug ?? null }}
      items={editorItems}
      fields={fields ?? []}
      groups={groups ?? []}
      trust={me?.trust_level ?? 0}
      results={(results ?? []) as ResultRow[]}
      links={{ web: links.web, telegram: links.telegram }}
      created={typeof sp.yangi === "string" ? Number(sp.yangi) : undefined}
      actions={{ saveMeta, saveItem, removeItem, publish, setStatus }}
    />
  );
}
