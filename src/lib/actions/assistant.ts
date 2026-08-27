"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import {
  answerCustomerQuestion,
  customerAssistantEnabled,
} from "@/lib/services/ai";

const historySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().min(1).max(2_000),
    }),
  )
  .max(10);

export type AssistantState =
  | { error: string; id?: undefined; question?: undefined; answer?: undefined }
  | { id: string; question: string; answer: string; error?: undefined }
  | null;

export async function askCustomerAssistant(
  _previous: AssistantState,
  formData: FormData,
): Promise<AssistantState> {
  const user = await requireUser();
  if (!(await customerAssistantEnabled())) {
    return { error: "The customer assistant is not available." };
  }
  const question = String(formData.get("question") ?? "").trim();
  if (question.length < 3 || question.length > 2_000) {
    return { error: "Enter a question between 3 and 2,000 characters." };
  }

  let history: z.infer<typeof historySchema> = [];
  try {
    const parsed = historySchema.safeParse(
      JSON.parse(String(formData.get("history") ?? "[]")),
    );
    if (!parsed.success) return { error: "The conversation history is invalid." };
    history = parsed.data;
  } catch {
    return { error: "The conversation history is invalid." };
  }

  const configuredLimit = Number(
    await getSetting("ai_customer_assistant_hourly_limit"),
  );
  const hourlyLimit = Number.isFinite(configuredLimit)
    ? Math.max(0, Math.floor(configuredLimit))
    : 20;
  if (hourlyLimit === 0) {
    return { error: "The customer assistant is not accepting questions." };
  }
  const used = await db.auditLog.count({
    where: {
      userId: user.id,
      action: "customer.ai_assistant_asked",
      createdAt: { gte: new Date(Date.now() - 3_600_000) },
    },
  });
  if (used >= hourlyLimit) {
    return { error: "You have reached the assistant's hourly question limit." };
  }

  try {
    const answer = await answerCustomerQuestion(user.id, question, history);
    if (!answer) return { error: "The customer assistant is not available." };
    await audit("customer.ai_assistant_asked", {
      userId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: { questionLength: question.length },
    });
    return { id: randomUUID(), question, answer };
  } catch {
    return {
      error: "The assistant could not answer right now. Please open a ticket.",
    };
  }
}
