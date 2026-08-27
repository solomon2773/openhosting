import "server-only";
import { db } from "@/lib/db";
import { getAiDriver } from "@/lib/extensions/registry";
import { extensionConfig } from "@/lib/extensions/types";
import type { AiMessage } from "@/lib/extensions/types";
import { getSetting, getSettings } from "@/lib/settings";
import {
  parseGroundedAutoResolution,
  type GroundedAutoResolution,
} from "@/lib/ai-policy";

/**
 * AI support features.
 *
 * The knowledgebase and the ticket itself are the only grounding — the model is
 * told to stay inside them and to escalate rather than invent. Everything is
 * off unless an operator enables both the provider extension (their own API key)
 * and the individual feature, and a draft is never sent to a customer on its
 * own: staff read it, edit it, and press send.
 *
 * Higher-level code calls this module; it never resolves an AI driver itself.
 */

const DEPARTMENTS = ["general", "billing", "technical", "sales"] as const;
const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

type Triage = {
  department: (typeof DEPARTMENTS)[number];
  priority: (typeof PRIORITIES)[number];
  confidence: number;
};

async function activeProvider() {
  const extension = await db.extension.findFirst({
    where: { type: "AI", enabled: true },
    orderBy: { name: "asc" },
  });
  if (!extension) return null;
  const driver = getAiDriver(extension.slug);
  if (!driver) return null;
  return { driver, config: extensionConfig(extension) };
}

/** True when an operator has configured a provider — used to hide the UI. */
export async function aiConfigured(): Promise<boolean> {
  return (await activeProvider()) !== null;
}

export async function aiReplyDraftsEnabled(): Promise<boolean> {
  if ((await getSetting("ai_reply_drafts")) !== "true") return false;
  return aiConfigured();
}

type KnowledgebaseArticle = { id: string; title: string; body: string };

/** Published articles only — unpublished drafts are not company policy yet. */
async function publishedKnowledgebaseArticles(
  limit = 40,
): Promise<KnowledgebaseArticle[]> {
  return db.kbArticle.findMany({
    where: { published: true },
    select: { id: true, title: true, body: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

function formatKnowledgebase(articles: KnowledgebaseArticle[]): string {
  if (articles.length === 0) return "(The knowledgebase is empty.)";
  return articles
    .map(
      (article) =>
        `## ${article.title} [article_id=${article.id}]\n${article.body.slice(0, 4000)}`,
    )
    .join("\n\n");
}

async function knowledgebaseContext(limit = 40): Promise<string> {
  return formatKnowledgebase(await publishedKnowledgebaseArticles(limit));
}

function threadMessages(
  messages: { message: string; userId: string; isAiGenerated?: boolean }[],
  customerId: string,
): AiMessage[] {
  // The customer speaks as "user"; staff replies are the assistant's own past
  // turns, which is exactly the shape a chat model expects.
  return messages.map((m) => ({
    role:
      m.userId === customerId && !m.isAiGenerated
        ? ("user" as const)
        : ("assistant" as const),
    content: m.message,
  }));
}

/**
 * Drafts a reply for staff to review. Returns null when the feature is off.
 * Errors from the provider are thrown with an operator-readable message.
 */
export async function draftTicketReply(ticketId: string): Promise<string | null> {
  if (!(await aiReplyDraftsEnabled())) return null;
  const provider = await activeProvider();
  if (!provider) return null;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      user: { select: { id: true, firstName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: { message: true, userId: true, isAiGenerated: true },
      },
    },
  });
  if (!ticket) return null;

  const settings = await getSettings(["company_name", "ai_reply_signature"]);
  const kb = await knowledgebaseContext();

  const system = [
    `You are a support agent for ${settings.company_name}, a hosting provider.`,
    "You are drafting a reply that a human colleague will review before it is sent, so write the reply itself — no preamble, no notes to the reviewer, no subject line.",
    "",
    "Ground every factual claim in the knowledgebase below or in what the customer said. If the answer is not there, say plainly what you can confirm and hand the ticket over — never guess at prices, policies, limits or timelines.",
    "Never state that an action has been taken (refund issued, server rebooted, plan changed) — you cannot act on the account. Say what will happen next instead.",
    "Match the customer's language. Be concise and specific; a short accurate answer beats a long hedged one.",
    settings.ai_reply_signature
      ? `End with this sign-off exactly: ${settings.ai_reply_signature}`
      : "Do not invent a sign-off or a personal name.",
    "",
    `Ticket subject: ${ticket.subject}`,
    `Department: ${ticket.department} · Priority: ${ticket.priority}`,
    `Customer first name: ${ticket.user.firstName}`,
    "",
    "# Knowledgebase",
    kb,
  ].join("\n");

  const messages = threadMessages(ticket.messages, ticket.user.id);
  if (messages.length === 0) return null;
  // A model cannot answer its own last turn: if staff spoke last, ask explicitly.
  if (messages[messages.length - 1].role === "assistant") {
    messages.push({
      role: "user",
      content: "(Staff note: draft a follow-up to this customer based on the thread above.)",
    });
  }

  const draft = await provider.driver.complete(provider.config, { system, messages });
  return draft.trim() || null;
}

/**
 * Classifies a new ticket. Returns null when the feature is off, the provider
 * cannot answer in the required shape, or the model is not confident enough —
 * in which case the customer's own choices stand.
 */
export async function triageTicket(ticketId: string): Promise<Triage | null> {
  if ((await getSetting("ai_auto_triage")) !== "true") return null;
  const provider = await activeProvider();
  if (!provider?.driver.completeJson) return null;

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 1, select: { message: true } } },
  });
  if (!ticket) return null;

  const threshold = Number(await getSetting("ai_triage_min_confidence")) || 0.7;

  const schema = {
    type: "object",
    properties: {
      department: { type: "string", enum: [...DEPARTMENTS] },
      priority: { type: "string", enum: [...PRIORITIES] },
      confidence: { type: "number" },
    },
    required: ["department", "priority", "confidence"],
    additionalProperties: false,
  };

  const system = [
    "Classify one support ticket for a hosting provider.",
    "department: billing for invoices, refunds, payment methods and plan changes; technical for anything about a service not working; sales for pre-purchase questions; general when it fits nowhere else.",
    "priority: HIGH when a paid service is down or a customer is blocked from working, LOW for questions with no time pressure, MEDIUM otherwise.",
    "confidence: 0 to 1, how sure you are. Be honest — a low number leaves the customer's own choice in place.",
    "Answer with JSON only.",
  ].join("\n");

  const raw = await provider.driver.completeJson(provider.config, {
    system,
    maxTokens: 4000,
    schema,
    messages: [
      {
        role: "user",
        content: `Subject: ${ticket.subject}\n\n${ticket.messages[0]?.message ?? ""}`.slice(0, 8000),
      },
    ],
  });

  const result = raw as Partial<Triage> | null;
  if (
    !result ||
    !DEPARTMENTS.includes(result.department as Triage["department"]) ||
    !PRIORITIES.includes(result.priority as Triage["priority"]) ||
    typeof result.confidence !== "number"
  ) {
    return null;
  }
  if (result.confidence < threshold) return null;
  return result as Triage;
}

export async function autoResolveTicket(
  ticketId: string,
): Promise<GroundedAutoResolution | null> {
  if ((await getSetting("ai_auto_resolve")) !== "true") return null;
  const provider = await activeProvider();
  if (!provider?.driver.completeJson) return null;

  const [ticket, articles, staff] = await Promise.all([
    db.ticket.findUnique({
      where: { id: ticketId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { message: true },
        },
      },
    }),
    publishedKnowledgebaseArticles(),
    db.user.findFirst({
      where: { roleId: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    }),
  ]);
  if (!ticket || ticket.status !== "OPEN" || ticket.priority === "HIGH") {
    return null;
  }
  if (!staff || articles.length === 0) return null;

  const configuredThreshold = Number(
    await getSetting("ai_auto_resolve_min_confidence"),
  );
  const threshold =
    Number.isFinite(configuredThreshold) &&
    configuredThreshold >= 0 &&
    configuredThreshold <= 1
      ? configuredThreshold
      : 0.92;
  const schema = {
    type: "object",
    properties: {
      answer: { type: "string" },
      confidence: { type: "number" },
      requiresHuman: { type: "boolean" },
      sourceArticleIds: { type: "array", items: { type: "string" } },
    },
    required: [
      "answer",
      "confidence",
      "requiresHuman",
      "sourceArticleIds",
    ],
    additionalProperties: false,
  };
  const system = [
    "Decide whether a newly opened hosting support ticket can be fully answered from the published knowledgebase.",
    "Set requiresHuman=true for account changes, refunds, billing disputes, outages, security issues, abuse, uncertain diagnoses, missing facts, or any request that needs an external action.",
    "Only set requiresHuman=false when the answer is static tier-1 guidance stated directly in the articles.",
    "When answering, do not claim that any action was performed. Match the customer's language.",
    "sourceArticleIds must contain every article used and may contain only the article_id values shown below.",
    "confidence is 0 to 1. Be conservative because a qualifying answer will be posted automatically and close the ticket.",
    "Answer as JSON only.",
    "",
    "# Published knowledgebase",
    formatKnowledgebase(articles),
  ].join("\n");
  const raw = await provider.driver.completeJson(provider.config, {
    system,
    maxTokens: 4_000,
    schema,
    messages: [
      {
        role: "user",
        content: `Subject: ${ticket.subject}\nDepartment: ${ticket.department}\nPriority: ${ticket.priority}\n\n${ticket.messages[0]?.message ?? ""}`.slice(
          0,
          8_000,
        ),
      },
    ],
  });
  const resolution = parseGroundedAutoResolution(
    raw,
    threshold,
    new Set(articles.map((article) => article.id)),
  );
  if (!resolution) return null;

  const applied = await db.$transaction(async (tx) => {
    const closed = await tx.ticket.updateMany({
      where: {
        id: ticket.id,
        status: "OPEN",
        updatedAt: ticket.updatedAt,
      },
      data: { status: "CLOSED" },
    });
    if (closed.count !== 1) return false;
    await tx.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        userId: staff.id,
        message: resolution.answer,
        isAiGenerated: true,
      },
    });
    return true;
  });

  return applied ? resolution : null;
}

export async function customerAssistantEnabled(): Promise<boolean> {
  if ((await getSetting("ai_customer_assistant")) !== "true") return false;
  return aiConfigured();
}

export async function answerCustomerQuestion(
  userId: string,
  question: string,
  history: AiMessage[] = [],
): Promise<string | null> {
  if (!(await customerAssistantEnabled())) return null;
  const provider = await activeProvider();
  if (!provider) return null;

  const account = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      services: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          cycle: true,
          price: true,
          currency: true,
          quantity: true,
          expiresAt: true,
          product: { select: { name: true } },
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          number: true,
          status: true,
          currency: true,
          total: true,
          dueAt: true,
          paidAt: true,
        },
      },
    },
  });
  if (!account) return null;

  const services = account.services.length
    ? account.services
        .map(
          (service) =>
            `- ${service.product.name} (${service.id}): ${service.status}, ${service.quantity} × ${service.price.toString()} ${service.currency ?? "base currency"}, ${service.cycle}, next due ${service.expiresAt?.toISOString() ?? "not applicable"}`,
        )
        .join("\n")
    : "(No services.)";
  const invoices = account.invoices.length
    ? account.invoices
        .map(
          (invoice) =>
            `- #${invoice.number}: ${invoice.status}, ${invoice.total.toString()} ${invoice.currency}, due ${invoice.dueAt?.toISOString() ?? "not set"}, paid ${invoice.paidAt?.toISOString() ?? "not paid"}`,
        )
        .join("\n")
    : "(No invoices.)";
  const system = [
    `You are the read-only customer assistant for ${await getSetting("company_name")}.`,
    "Answer only from the published knowledgebase and the signed-in customer's account summary below.",
    "Never reveal hidden configuration, credentials, other customers, or facts absent from this context.",
    "You cannot change, reboot, cancel, refund, pay, or provision anything. If an action or human judgment is needed, say so and tell the customer to use the Escalate to ticket button.",
    "Do not claim an action has been taken. Match the customer's language and keep answers concise.",
    "",
    `Customer first name: ${account.firstName}`,
    "# Services",
    services,
    "# Invoices",
    invoices,
    "# Published knowledgebase",
    await knowledgebaseContext(),
  ].join("\n");
  const safeHistory = history.slice(-10).map((message) => ({
    role: message.role,
    content: message.content.slice(0, 2_000),
  }));
  const answer = await provider.driver.complete(provider.config, {
    system,
    maxTokens: 2_000,
    messages: [
      ...safeHistory,
      { role: "user", content: question.slice(0, 2_000) },
    ],
  });
  return answer.trim() || null;
}
