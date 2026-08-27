import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createOpenHostingMcpServer } from "../../../../mcp/server.mjs";
import { authenticateOauthToken, oauthBearerChallenge } from "@/lib/oauth";
import {
  canonicalMcpResource,
  isAllowedMcpOrigin,
  MCP_TOOL_NAMES,
  MCP_TOOL_SCOPES,
} from "@/lib/oauth-policy";
import { publicUrl } from "@/lib/settings";

export const runtime = "nodejs";

function withCors(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  if (origin) headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version");
  headers.append("Vary", "Origin");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handle(request: NextRequest): Promise<Response> {
  const configuredBaseUrl = await publicUrl();
  const configuredOrigin = new URL(configuredBaseUrl).origin;
  const requestOrigin = request.headers.get("origin");
  if (
    !isAllowedMcpOrigin(
      requestOrigin,
      configuredOrigin,
      process.env.MCP_ALLOWED_ORIGINS,
    )
  ) {
    return NextResponse.json({ error: "Forbidden origin" }, { status: 403 });
  }

  if (request.method === "OPTIONS") {
    const response = new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Authorization, Content-Type, Last-Event-ID, Mcp-Session-Id, MCP-Protocol-Version",
        "Access-Control-Max-Age": "86400",
      },
    });
    return withCors(response, requestOrigin);
  }

  const resource = canonicalMcpResource(configuredBaseUrl);
  const authenticated = await authenticateOauthToken(request, resource);
  if (!authenticated) {
    const metadataUrl = `${configuredBaseUrl.replace(/\/+$/, "")}/.well-known/oauth-protected-resource`;
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32001, message: "OAuth bearer token required" },
        id: null,
      }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "WWW-Authenticate": oauthBearerChallenge(
            metadataUrl,
            MCP_TOOL_SCOPES,
          ),
        },
      },
    );
  }

  const allowedTools = MCP_TOOL_NAMES.filter((tool) =>
    authenticated.scopes.includes(`mcp:tool:${tool}`),
  );
  if (allowedTools.length === 0) {
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32003, message: "Token has no MCP tool scopes" },
        id: null,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const server = createOpenHostingMcpServer({
    url: configuredBaseUrl,
    apiToken: authenticated.rawToken,
    cronSecret: authenticated.rawToken,
    allowedTools,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const response = await transport.handleRequest(request, {
      authInfo: {
        token: authenticated.rawToken,
        clientId: authenticated.client.clientId,
        scopes: authenticated.scopes,
        expiresAt: Math.floor(authenticated.token.expiresAt.getTime() / 1_000),
        resource: new URL(resource),
        extra: { userId: authenticated.user.id },
      },
    });
    return withCors(response, requestOrigin);
  } finally {
    await transport.close();
    await server.close();
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
export const OPTIONS = handle;
