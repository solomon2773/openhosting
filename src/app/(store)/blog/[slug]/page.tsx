import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await db.announcement.findUnique({ where: { slug } });
  if (!post || !post.publishedAt) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm text-slate-400">{formatDate(post.publishedAt)}</p>
      <h1 className="mt-1 text-3xl font-bold">{post.title}</h1>
      <div
        className="prose prose-slate mt-6 max-w-none text-slate-700 [&_a]:text-brand-600"
        // announcement bodies are trusted admin-authored content
        dangerouslySetInnerHTML={{ __html: post.body.replace(/\n/g, "<br/>") }}
      />
    </article>
  );
}
