import Link from "next/link";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n";

export const metadata = { title: "News" };

export default async function BlogIndexPage() {
  const [t, posts] = await Promise.all([
    getT(),
    db.announcement.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">{t("nav.blog")}</h1>
      <div className="mt-8 space-y-6">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/blog/${post.slug}`}
            className="card block p-6 transition-shadow hover:shadow-md"
          >
            <p className="text-sm text-slate-400">
              {formatDate(post.publishedAt)}
            </p>
            <h2 className="mt-1 text-xl font-semibold hover:text-brand-600">
              {post.title}
            </h2>
            {post.excerpt && (
              <p className="mt-2 text-sm text-slate-500">{post.excerpt}</p>
            )}
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="py-16 text-center text-slate-400">—</p>
        )}
      </div>
    </div>
  );
}
