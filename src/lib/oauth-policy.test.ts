import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import {
  canonicalMcpResource,
  isAllowedMcpOrigin,
  mcpToolForApiRequest,
  requestedOauthScopes,
  verifyPkceS256,
} from "@/lib/oauth-policy";

describe("OAuth scope policy", () => {
  test("accepts only supported scopes allowed for the client", () => {
    const allowed = ["openid", "profile", "mcp:tool:list_users"];
    expect(requestedOauthScopes("openid mcp:tool:list_users", allowed)).toEqual([
      "openid",
      "mcp:tool:list_users",
    ]);
    expect(requestedOauthScopes("mcp:tool:service_action", allowed)).toBeNull();
    expect(requestedOauthScopes("unknown", allowed)).toBeNull();
  });

  test("maps REST calls to exact MCP tools", () => {
    expect(mcpToolForApiRequest("GET", "/api/v1/users")).toBe("list_users");
    expect(mcpToolForApiRequest("GET", "/api/v1/users/user-1")).toBe("get_user");
    expect(mcpToolForApiRequest("POST", "/api/v1/services/service-1")).toBe(
      "service_action",
    );
    expect(mcpToolForApiRequest("DELETE", "/api/v1/users/user-1")).toBeNull();
  });
});

describe("OAuth 2.1 security", () => {
  test("verifies an S256 PKCE challenge", () => {
    const verifier = "a".repeat(43);
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256("b".repeat(43), challenge)).toBe(false);
    expect(verifyPkceS256("short", challenge)).toBe(false);
  });

  test("canonicalizes the MCP resource and validates browser origins", () => {
    expect(canonicalMcpResource("https://billing.example.com/")).toBe(
      "https://billing.example.com/api/mcp",
    );
    expect(
      isAllowedMcpOrigin(
        "https://client.example.com",
        "https://billing.example.com",
        "https://client.example.com",
      ),
    ).toBe(true);
    expect(
      isAllowedMcpOrigin(
        "https://evil.example.com",
        "https://billing.example.com",
        undefined,
      ),
    ).toBe(false);
    expect(
      isAllowedMcpOrigin(null, "https://billing.example.com", undefined),
    ).toBe(true);
  });
});
