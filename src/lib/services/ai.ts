import "server-only";
import { db } from "@/lib/db";
import { getAiDriver } from "@/lib/extensions/registry";
import { extensionConfig } from "@/lib/extensions/types";
import type { AiMessage } from "@/lib/extensions/types";
import { getSetting, getSettings } from "@/lib/settings";

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

/** Published articles only — unpublished drafts are not company policy yet. */
async function knowledgebaseContext(limit = 40): Promise<string> {
  const articles = await db.kbArticle.findMany({
    where: { published: true },
    select: { title: true, body: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
  if (articles.length === 0) return "(The knowledgebase is empty.)";
  return articles
    .map((a) => `## ${a.title}\n${a.body.slice(0, 4000)}`)
    .join("\n\n");
}

function threadMessages(
  messages: { message: string; userId: string }[],
  customerId: string,
): AiMessage[] {
  // The customer speaks as "user"; staff replies are the assistant's own past
  // turns, which is exactly the shape a chat model expects.
  return messages.map((m) => ({
    role: m.userId === customerId ? ("user" as const) : ("assistant" as const),
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
      messages: { orderBy: { createdAt: "asc" }, select: { message: true, userId: true } },
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
