import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function KbArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await db.kbArticle.findUnique({
    where: { slug },
    include: { category: true },
  });
  if (!article || !article.published) notFound();

  // increment the view counter (fire-and-forget)
  await db.kbArticle.update({
    where: { id: article.id },
    data: { views: { increment: 1 } },
  });

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-slate-500">
        <Link href="/kb" className="hover:underline">
          Knowledgebase
        </Link>
        {article.category && <> / {article.category.name}</>}
      </p>
      <h1 className="mt-2 text-3xl font-bold">{article.title}</h1>
      <p className="mt-1 text-sm text-slate-400">
        Updated {formatDate(article.updatedAt)}
      </p>
      <div
        className="prose prose-slate mt-6 max-w-none text-slate-700 [&_a]:text-brand-600"
        // article bodies are trusted admin-authored content
        dangerouslySetInnerHTML={{ __html: article.body.replace(/\n/g, "<br/>") }}
      />
    </article>
  );
}
