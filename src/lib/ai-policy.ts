export type GroundedAutoResolution = {
  answer: string;
  confidence: number;
  sourceArticleIds: string[];
};

export function parseGroundedAutoResolution(
  value: unknown,
  minimumConfidence: number,
  publishedArticleIds: ReadonlySet<string>,
): GroundedAutoResolution | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.requiresHuman !== false) return null;
  if (
    typeof candidate.confidence !== "number" ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < minimumConfidence ||
    candidate.confidence > 1
  ) {
    return null;
  }
  if (typeof candidate.answer !== "string") return null;
  const answer = candidate.answer.trim();
  if (answer.length < 20 || answer.length > 4_000) return null;
  if (!Array.isArray(candidate.sourceArticleIds)) return null;
  const sourceArticleIds = [
    ...new Set(
      candidate.sourceArticleIds.filter(
        (id): id is string =>
          typeof id === "string" && publishedArticleIds.has(id),
      ),
    ),
  ];
  if (
    sourceArticleIds.length === 0 ||
    sourceArticleIds.length !== candidate.sourceArticleIds.length
  ) {
    return null;
  }

  return {
    answer,
    confidence: candidate.confidence,
    sourceArticleIds,
  };
}
