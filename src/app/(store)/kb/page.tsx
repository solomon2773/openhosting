import Link from "next/link";
import { db } from "@/lib/db";

export const metadata = { title: "Knowledgebase" };

export default async function KnowledgebasePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const [categories, results] = await Promise.all([
    db.kbCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        articles: {
          where: { published: true },
          orderBy: { title: "asc" },
        },
      },
    }),
    q
      ? db.kbArticle.findMany({
          where: {
            published: true,
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { views: "desc" },
          take: 25,
        })
      : null,
  ]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold">Knowledgebase</h1>
      <p className="mt-1 text-slate-500">
        Guides and answers to common questions.
      </p>

      <form className="mt-6 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search articles…"
          className="input"
        />
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {results ? (
        <div className="mt-8">
          <h2 className="mb-3 font-semibold">
            {results.length} result{results.length === 1 ? "" : "s"} for
            &ldquo;{q}&rdquo;
          </h2>
          <ul className="space-y-2">
            {results.map((article) => (
              <li key={article.id}>
                <Link
                  href={`/kb/${article.slug}`}
                  className="text-brand-600 hover:underline"
                >
                  {article.title}
                </Link>
              </li>
            ))}
            {results.length === 0 && (
              <li className="text-slate-400">No articles found.</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {categories.map((category) => (
            <div key={category.id}>
              <h2 className="text-xl font-semibold">{category.name}</h2>
              {category.description && (
                <p className="mt-1 text-sm text-slate-500">
                  {category.description}
                </p>
              )}
              <ul className="mt-3 space-y-1">
                {category.articles.map((article) => (
                  <li key={article.id}>
                    <Link
                      href={`/kb/${article.slug}`}
                      className="text-brand-600 hover:underline"
                    >
                      {article.title}
                    </Link>
                  </li>
                ))}
                {category.articles.length === 0 && (
                  <li className="text-sm text-slate-400">
                    No articles yet.
                  </li>
                )}
              </ul>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="py-12 text-center text-slate-400">
              The knowledgebase is empty.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
