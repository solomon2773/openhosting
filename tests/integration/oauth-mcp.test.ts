import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, expect, test } from "vitest";
import { GET as listUsers } from "@/app/api/v1/users/route";
import { GET as getUser } from "@/app/api/v1/users/[id]/route";
import { POST as exchangeToken } from "@/app/oauth/token/route";
import { POST as mcpEndpoint } from "@/app/api/mcp/route";
import { sha256 } from "@/lib/auth";
import { db } from "@/lib/db";
import { authenticateOauthToken } from "@/lib/oauth";

const resource = "http://localhost:3000/api/mcp";

beforeEach(async () => {
  await db.oauthClient.deleteMany();
  await db.user.deleteMany();
  await db.setting.deleteMany();
});

afterAll(async () => {
  await db.$disconnect();
});

async function createUser() {
  return db.user.create({
    data: {
      email: "oauth-user@example.test",
      password: "not-used",
      firstName: "OAuth",
      lastName: "Test",
    },
  });
}

test("exchanges a public-client PKCE code and rotates its refresh token", async () => {
  const user = await createUser();
  const client = await db.oauthClient.create({
    data: {
      name: "MCP test client",
      clientId: "ohc_test_public",
      clientSecret: null,
      publicClient: true,
      redirectUris: "https://client.example.test/callback",
      allowedScopes: ["mcp:tool:list_users", "offline_access"],
    },
  });
  const verifier = "v".repeat(43);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const rawCode = "authorization-code";
  await db.oauthCode.create({
    data: {
      codeHash: sha256(rawCode),
      clientId: client.id,
      userId: user.id,
      redirectUri: "https://client.example.test/callback",
      codeChallenge: challenge,
      scopes: ["mcp:tool:list_users", "offline_access"],
      resource,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });

  const response = await exchangeToken(
    new NextRequest("http://localhost:3000/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: client.clientId,
        code: rawCode,
        code_verifier: verifier,
        redirect_uri: "https://client.example.test/callback",
        resource,
      }),
    }),
  );
  expect(response.status).toBe(200);
  const first = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  };
  expect(first.expires_in).toBe(3_600);
  expect(first.scope).toContain("mcp:tool:list_users");

  const authenticated = await authenticateOauthToken(
    new Request(resource, {
      headers: { Authorization: `Bearer ${first.access_token}` },
    }),
    resource,
  );
  expect(authenticated?.user.id).toBe(user.id);

  const refresh = await exchangeToken(
    new NextRequest("http://localhost:3000/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: client.clientId,
        refresh_token: first.refresh_token,
        resource,
      }),
    }),
  );
  expect(refresh.status).toBe(200);
  const second = (await refresh.json()) as {
    access_token: string;
    refresh_token: string;
  };
  expect(second.access_token).not.toBe(first.access_token);
  expect(second.refresh_token).not.toBe(first.refresh_token);

  const replay = await exchangeToken(
    new NextRequest("http://localhost:3000/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: client.clientId,
        refresh_token: first.refresh_token,
        resource,
      }),
    }),
  );
  expect(replay.status).toBe(400);
});

test("enforces exact per-tool scope on OAuth-backed REST calls", async () => {
  const user = await createUser();
  const client = await db.oauthClient.create({
    data: {
      name: "Scoped MCP client",
      clientId: "ohc_scoped",
      clientSecret: null,
      publicClient: true,
      redirectUris: "https://client.example.test/callback",
      allowedScopes: ["mcp:tool:list_users"],
    },
  });
  const accessToken = "oht_scopedaccesstoken";
  await db.oauthToken.create({
    data: {
      tokenHash: sha256(accessToken),
      clientId: client.id,
      userId: user.id,
      scopes: ["mcp:tool:list_users"],
      resource,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const headers = { Authorization: `Bearer ${accessToken}` };

  const collection = await listUsers(
    new Request("http://localhost:3000/api/v1/users", { headers }),
    { params: Promise.resolve({}) },
  );
  expect(collection.status).toBe(200);

  const detail = await getUser(
    new Request(`http://localhost:3000/api/v1/users/${user.id}`, { headers }),
    { params: Promise.resolve({ id: user.id }) },
  );
  expect(detail.status).toBe(401);
});

test("serves only OAuth-scoped tools over Streamable HTTP", async () => {
  const user = await createUser();
  const client = await db.oauthClient.create({
    data: {
      name: "Remote MCP client",
      clientId: "ohc_remote",
      clientSecret: null,
      publicClient: true,
      redirectUris: "https://client.example.test/callback",
      allowedScopes: ["mcp:tool:list_users"],
    },
  });
  const accessToken = "oht_remoteaccesstoken";
  await db.oauthToken.create({
    data: {
      tokenHash: sha256(accessToken),
      clientId: client.id,
      userId: user.id,
      scopes: ["mcp:tool:list_users"],
      resource,
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
  };

  const initialized = await mcpEndpoint(
    new NextRequest(resource, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "integration-test", version: "1.0.0" },
        },
      }),
    }),
  );
  expect(initialized.status).toBe(200);
  expect((await initialized.json()).result.serverInfo.name).toBe("openhosting");

  const tools = await mcpEndpoint(
    new NextRequest(resource, {
      method: "POST",
      headers: { ...headers, "MCP-Protocol-Version": "2025-11-25" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
    }),
  );
  expect(tools.status).toBe(200);
  expect((await tools.json()).result.tools.map((tool: { name: string }) => tool.name)).toEqual([
    "list_users",
  ]);
});
