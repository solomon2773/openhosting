import { describe, expect, test } from "vitest";
import { parseGroundedAutoResolution } from "@/lib/ai-policy";

const published = new Set(["kb-1", "kb-2"]);

describe("AI auto-resolution policy", () => {
  test("accepts a high-confidence answer grounded in published articles", () => {
    expect(
      parseGroundedAutoResolution(
        {
          answer: "Follow the documented reset steps, then sign in again.",
          confidence: 0.96,
          requiresHuman: false,
          sourceArticleIds: ["kb-1"],
        },
        0.92,
        published,
      ),
    ).toEqual({
      answer: "Follow the documented reset steps, then sign in again.",
      confidence: 0.96,
      sourceArticleIds: ["kb-1"],
    });
  });

  test("rejects escalation, low confidence, and uncited answers", () => {
    const base = {
      answer: "This answer is long enough to pass the content length check.",
      confidence: 0.96,
      requiresHuman: false,
      sourceArticleIds: ["kb-1"],
    };
    expect(
      parseGroundedAutoResolution(
        { ...base, requiresHuman: true },
        0.92,
        published,
      ),
    ).toBeNull();
    expect(
      parseGroundedAutoResolution(
        { ...base, confidence: 0.91 },
        0.92,
        published,
      ),
    ).toBeNull();
    expect(
      parseGroundedAutoResolution(
        { ...base, sourceArticleIds: [] },
        0.92,
        published,
      ),
    ).toBeNull();
  });

  test("rejects references to unpublished or invented articles", () => {
    expect(
      parseGroundedAutoResolution(
        {
          answer: "This answer is long enough but cites an unknown source.",
          confidence: 0.99,
          requiresHuman: false,
          sourceArticleIds: ["kb-missing"],
        },
        0.92,
        published,
      ),
    ).toBeNull();
  });
});
