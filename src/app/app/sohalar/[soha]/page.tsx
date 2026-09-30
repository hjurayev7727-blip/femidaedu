import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FieldView, type FieldArticle, type FieldChapter, type FieldDoc, type FieldInfo } from "@/components/fields/field-view";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Huquq sohasi" };

export default async function FieldPage({ params, searchParams }: PageProps<"/app/sohalar/[soha]">) {
  const { soha } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const { data: field } = await supabase.from("fields").select("id, slug, title, priority, color, icon").eq("slug", soha).maybeSingle<FieldInfo & { id: number }>();
  if (!field) notFound();

  const [{ data: docs }, { data: topics }] = await Promise.all([
    supabase.from("documents").select("id, title, short_title, lex_url").eq("field_id", field.id).order("number").returns<FieldDoc[]>(),
    supabase.from("life_topics").select("id, title, life_topic_articles(article_id)").eq("field_id", field.id).order("sort")
      .returns<{ id: number; title: string; life_topic_articles: { article_id: number }[] }[]>(),
  ]);
  const docList = docs ?? [];
  const [chapterRes, ...articleRes] = await Promise.all([
    supabase.from("chapters").select("id, document_id, number, title, sort").in("document_id", docList.map((d) => d.id).concat(0)).order("sort").returns<FieldChapter[]>(),
    ...docList.map((d) => supabase.rpc("document_articles", { p_document: d.id })),
  ]);

  return (
    <FieldView
      field={field}
      view={sp.korinish === "hayotiy" ? "hayotiy" : "kodeks"}
      docs={docList}
      chapters={chapterRes.data ?? []}
      articlesByDoc={new Map(docList.map((d, i) => [d.id, (articleRes[i].data ?? []) as FieldArticle[]]))}
      topics={(topics ?? []).map((t) => ({ id: t.id, title: t.title, article_ids: t.life_topic_articles.map((x) => x.article_id) }))}
    />
  );
}
