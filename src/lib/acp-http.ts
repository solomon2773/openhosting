import { NextResponse } from "next/server";
import { ACP_VERSION } from "@/lib/agent-commerce-policy";
import { AgentCheckoutError } from "@/lib/services/agent-checkout";

export function validateAcpRequest(request: Request, requireIdempotency = true) {
  const version = request.headers.get("api-version");
  if (version !== ACP_VERSION) {
    return {
      response: NextResponse.json(
        {
          type: "invalid_request_error",
          code: version ? "unsupported_api_version" : "missing_api_version",
          message: `API-Version: ${ACP_VERSION} is required.`,
          supported_versions: [ACP_VERSION],
        },
        { status: 400 },
      ),
      idempotencyKey: null,
    };
  }
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? null;
  if (requireIdempotency && (!idempotencyKey || idempotencyKey.length > 200)) {
    return {
      response: NextResponse.json(
        {
          type: "invalid_request_error",
          code: "idempotency_key_required",
          message: "A valid Idempotency-Key header is required.",
        },
        { status: 400 },
      ),
      idempotencyKey: null,
    };
  }
  return { response: null, idempotencyKey };
}

export function acpResponse(
  body: unknown,
  input: { status?: number; idempotencyKey?: string | null; replayed?: boolean } = {},
) {
  return NextResponse.json(body, {
    status: input.status ?? 200,
    headers: {
      ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      ...(input.replayed ? { "Idempotent-Replayed": "true" } : {}),
      "Cache-Control": "no-store",
    },
  });
}

export function acpError(error: unknown) {
  if (error instanceof AgentCheckoutError) {
    return NextResponse.json(
      {
        type: "invalid_request_error",
        code: error.code,
        message: error.message,
      },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      type: "api_error",
      code: "checkout_failed",
      message: "Checkout could not be completed.",
    },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
