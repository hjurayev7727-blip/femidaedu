import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ARTICLE_ERRORS, ArticleView, type ArticleData } from "@/components/fields/article-view";
import { requireUser } from "@/lib/auth";
import { explainArticle } from "../../../yordamchi/actions";
import { startArticlePractice } from "../../actions";

export const metadata: Metadata = { title: "Modda" };

type Doc = { id: number; title: string; short_title: string | null; lex_url: string | null; field_id: number | null };

export default async function ArticlePage({ params, searchParams }: PageProps<"/app/sohalar/[soha]/[modda]">) {
  const { soha, modda } = await params;
  const sp = await searchParams;
  const id = Number(modda);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const { supabase, userId } = await requireUser();

  const { data: a } = await supabase.from("articles").select("id, document_id, number, title, body, status")
    .eq("id", id).neq("status", "repealed").maybeSingle<ArticleData & { document_id: number }>();
  if (!a) notFound();
  const [{ data: doc }, { data: field }, { data: nav }, { data: prog }, { data: free }, { data: premium }, { count }] = await Promise.all([
    supabase.from("documents").select("id, title, short_title, lex_url, field_id").eq("id", a.document_id).maybeSingle<Doc>(),
    supabase.from("fields").select("id, slug, title, color").eq("slug", soha).maybeSingle<{ id: number; slug: string; title: string; color: string }>(),
    supabase.from("articles").select("id, number").eq("document_id", a.document_id).neq("status", "repealed").order("sort").returns<{ id: number; number: string }[]>(),
    supabase.from("article_progress").select("seen, correct").eq("user_id", userId).eq("article_id", a.id).maybeSingle<{ seen: number; correct: number }>(),
    supabase.rpc("article_is_free", { p_article: a.id }),
    supabase.rpc("is_premium"),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("status", "published").contains("article_ids", [a.id]),
  ]);
  if (!doc || !field || doc.field_id !== field.id) notFound();

  const list = nav ?? [];
  const i = list.findIndex((x) => x.id === a.id);
  const locked = !free && !premium;
  const aiTest = (
    <>
      <form action={explainArticle}>
        <input type="hidden" name="article" value={a.id} />
        <button className="btn-ghost">💡 AI tushuntirsin</button>
      </form>
      <Link href={`/app/testlar/yangi?hujjat=${doc.id}&moddalar=${encodeURIComponent(a.number)}`} className="btn-ghost">🤖 AI bilan test</Link>
    </>
  );
  const action = locked ? (
    <div className="flex flex-wrap gap-2">{aiTest}<Link href="/app/premium" className="btn-gold">Premium bilan ochish</Link></div>
  ) : (
    <div className="flex flex-wrap gap-2">
      {aiTest}
      <form action={startArticlePractice}>
        <input type="hidden" name="article" value={a.id} />
        <input type="hidden" name="back" value={`/app/sohalar/${field.slug}/${a.id}`} />
        <button className="btn-primary" disabled={!count}>Testni boshlash</button>
      </form>
    </div>
  );

  return (
    <ArticleView
      article={a}
      field={field}
      doc={doc}
      prev={i > 0 ? list[i - 1] : null}
      next={i >= 0 && i < list.length - 1 ? list[i + 1] : null}
      progress={prog ?? { seen: 0, correct: 0 }}
      questions={count ?? 0}
      locked={locked}
      error={ARTICLE_ERRORS[String(sp.xato ?? "")]}
      action={action}
    />
  );
}
