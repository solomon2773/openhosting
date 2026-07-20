import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withApiKey } from "@/lib/api-auth";

export const GET = withApiKey("knowledgebase:read", async (request) => {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  const articles = await db.kbArticle.findMany({
    where: {
      published: true,
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { views: "desc" },
    include: { category: true },
  });
  return NextResponse.json({
    data: articles.map((a) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category?.slug ?? null,
      views: a.views,
      updated_at: a.updatedAt,
    })),
  });
});
