import Anthropic from "@anthropic-ai/sdk";
import type { AiDriver, AiRequest } from "@/lib/extensions/types";

// Claude, with the operator's own API key. Nothing is sent to Anthropic unless
// this extension is enabled and a feature that uses it is switched on.

const MODELS = [
  { value: "claude-opus-5", label: "Claude Opus 5 — most capable" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5 — balanced" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5 — fastest, cheapest" },
];

// Adaptive thinking and the effort control arrived with the 4.6 generation;
// sending either to Haiku 4.5 is rejected, so they are opt-in per model.
const SUPPORTS_EFFORT = new Set(["claude-opus-5", "claude-sonnet-5"]);

const DEFAULT_MODEL = "claude-opus-5";
// Thinking tokens count against max_tokens, so leave room for both.
const DEFAULT_MAX_TOKENS = 8000;

function client(config: Record<string, string>) {
  const apiKey = config.api_key?.trim();
  if (!apiKey) throw new Error("No Anthropic API key configured.");
  const baseURL = config.base_url?.trim();
  return new Anthropic({ apiKey, timeout: 120_000, ...(baseURL ? { baseURL } : {}) });
}

const EFFORTS = ["low", "medium", "high"] as const;
type Effort = (typeof EFFORTS)[number];

function effortOf(config: Record<string, string>): Effort {
  const value = config.effort;
  return (EFFORTS as readonly string[]).includes(value) ? (value as Effort) : "low";
}

// `format` is only set for the JSON path; both share model, budget and prompt.
function baseParams(
  config: Record<string, string>,
  request: AiRequest,
  format?: { type: "json_schema"; schema: Record<string, unknown> },
) {
  const model = config.model || DEFAULT_MODEL;
  const tuned = SUPPORTS_EFFORT.has(model);
  const outputConfig = {
    ...(tuned ? { effort: effortOf(config) } : {}),
    ...(format ? { format } : {}),
  };
  return {
    model,
    max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: request.system,
    messages: request.messages,
    ...(tuned ? { thinking: { type: "adaptive" as const } } : {}),
    ...(Object.keys(outputConfig).length > 0 ? { output_config: outputConfig } : {}),
  };
}

// Turns the SDK's typed errors into something an operator can act on; the
// service layer surfaces the message to staff.
function describe(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) {
    return "Anthropic rejected the API key — check it under Admin → Extensions.";
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return "This API key is not allowed to use the selected model.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Anthropic is rate-limiting this key — try again shortly.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Could not reach the Anthropic API from this server.";
  }
  if (error instanceof Anthropic.APIError) {
    return `Anthropic API error (${error.status}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export const anthropicAi: AiDriver = {
  slug: "anthropic",
  name: "Anthropic (Claude)",
  configFields: [
    {
      key: "api_key",
      label: "API key",
      type: "password",
      required: true,
      help: "From console.anthropic.com. Usage is billed to your own Anthropic account.",
    },
    { key: "model", label: "Model", type: "select", options: MODELS },
    {
      key: "effort",
      label: "Reasoning effort",
      type: "select",
      options: [
        { value: "low", label: "Low — fastest and cheapest" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High — most thorough" },
      ],
      help: "Higher effort costs more tokens. Low is plenty for support replies.",
    },
    {
      key: "base_url",
      label: "API base URL (optional)",
      type: "text",
      help: "Leave blank for api.anthropic.com. Set this to route through an Anthropic-compatible proxy or egress gateway.",
    },
  ],

  async complete(config, request) {
    try {
      const response = await client(config).messages.create(baseParams(config, request));
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
    } catch (error) {
      throw new Error(describe(error));
    }
  },

  async completeJson(config, request) {
    try {
      const response = await client(config).messages.create(
        baseParams(config, request, {
          type: "json_schema",
          schema: request.schema,
        }),
      );
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
      return text ? JSON.parse(text) : null;
    } catch (error) {
      throw new Error(describe(error));
    }
  },
};
