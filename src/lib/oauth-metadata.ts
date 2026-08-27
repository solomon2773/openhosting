import "server-only";

import { canonicalMcpResource, MCP_TOOL_SCOPES, OAUTH_SUPPORTED_SCOPES } from "@/lib/oauth-policy";
import { publicUrl } from "@/lib/settings";

export async function authorizationServerMetadata() {
  const baseUrl = (await publicUrl()).replace(/\/+$/, "");
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    userinfo_endpoint: `${baseUrl}/oauth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    scopes_supported: OAUTH_SUPPORTED_SCOPES,
  };
}

export async function protectedResourceMetadata() {
  const baseUrl = (await publicUrl()).replace(/\/+$/, "");
  return {
    resource: canonicalMcpResource(baseUrl),
    authorization_servers: [baseUrl],
    scopes_supported: MCP_TOOL_SCOPES,
    bearer_methods_supported: ["header"],
    resource_documentation: `${baseUrl}/docs/mcp`,
  };
}
