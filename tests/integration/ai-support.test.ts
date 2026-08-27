import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { db } from "@/lib/db";
import { autoResolveTicket } from "@/lib/services/ai";

const aiMocks = vi.hoisted(() => ({
  completeJson: vi.fn(),
}));

vi.mock("@/lib/extensions/registry", () => ({
  getAiDriver: () => ({
    slug: "test-ai",
    name: "Test AI",
    configFields: [],
    complete: vi.fn(),
    completeJson: aiMocks.completeJson,
  }),
}));

beforeEach(async () => {
  await db.user.deleteMany();
  await db.role.deleteMany();
  await db.extension.deleteMany();
  await db.kbArticle.deleteMany();
  await db.setting.deleteMany();
  vi.clearAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function setupAutoResolution(priority: "LOW" | "MEDIUM" | "HIGH") {
  const role = await db.role.create({
    data: { name: "AI test staff", permissions: ["tickets"] },
  });
  await db.user.create({
    data: {
      email: "ai-staff@example.test",
      password: "not-used",
      firstName: "Support",
      lastName: "Team",
      roleId: role.id,
    },
  });
  const customer = await db.user.create({
    data: {
      email: "ai-customer@example.test",
      password: "not-used",
      firstName: "Customer",
      lastName: "Test",
    },
  });
  const article = await db.kbArticle.create({
    data: {
      title: "Reset a password",
      slug: "reset-a-password",
      body: "Use the reset form and follow the emailed link.",
      published: true,
    },
  });
  await db.extension.create({
    data: {
      type: "AI",
      slug: "test-ai",
      name: "Test AI",
      enabled: true,
    },
  });
  await db.setting.createMany({
    data: [
      { key: "ai_auto_resolve", value: "true" },
      { key: "ai_auto_resolve_min_confidence", value: "0.92" },
    ],
  });
  const ticket = await db.ticket.create({
    data: {
      userId: customer.id,
      subject: "How do I reset my password?",
      priority,
      messages: {
        create: {
          userId: customer.id,
          message: "Please tell me the documented password reset steps.",
        },
      },
    },
  });
  return { article, ticket };
}

test("posts and closes a grounded high-confidence tier-1 answer", async () => {
  const { article, ticket } = await setupAutoResolution("LOW");
  aiMocks.completeJson.mockResolvedValue({
    answer: "Use the reset form and follow the link sent to your email address.",
    confidence: 0.98,
    requiresHuman: false,
    sourceArticleIds: [article.id],
  });

  expect(await autoResolveTicket(ticket.id)).toEqual(
    expect.objectContaining({ confidence: 0.98 }),
  );

  const updated = await db.ticket.findUniqueOrThrow({
    where: { id: ticket.id },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  expect(updated.status).toBe("CLOSED");
  expect(updated.messages).toHaveLength(2);
  expect(updated.messages[1]).toEqual(
    expect.objectContaining({
      isAiGenerated: true,
      message: "Use the reset form and follow the link sent to your email address.",
    }),
  );
});

test("never sends a high-priority ticket to the auto-resolution model", async () => {
  const { ticket } = await setupAutoResolution("HIGH");

  expect(await autoResolveTicket(ticket.id)).toBeNull();
  expect(aiMocks.completeJson).not.toHaveBeenCalled();
  expect(
    await db.ticket.findUniqueOrThrow({ where: { id: ticket.id } }),
  ).toEqual(expect.objectContaining({ status: "OPEN" }));
});
