# OAuth / SSO provider

OpenHosting can act as an **OAuth 2.1 identity provider**, letting other
applications sign users in with their OpenHosting account (single sign-on). This
also secures the hosted [MCP endpoint](../mcp.md). It is distinct from API keys,
which authenticate local or server-owned automation.

## Registering a client

Under **Admin → OAuth clients**, create a client with:

- **Application name**
- **Redirect URIs** — one per line, matched exactly
- **Client type** — public PKCE clients have no secret; confidential clients do
- **Allowed scopes** — standard identity scopes and/or exact
  `mcp:tool:<tool_name>` permissions

You always get a **client ID**. A confidential client also gets a **client
secret** shown once and stored hashed. Public clients authenticate the code
exchange with PKCE rather than a secret.

## The flow (authorization code)

**1. Generate a PKCE verifier and its S256 challenge.** The verifier must be
43–128 unreserved characters and stays inside the client. The challenge is
`BASE64URL(SHA256(verifier))`.

**2. Send the user to the authorize endpoint:**

```
GET /oauth/authorize?response_type=code
    &client_id=ohc_…
    &redirect_uri=https://app.example.com/callback
    &state=<random>
    &scope=openid%20profile%20email
    &code_challenge=<s256-challenge>
    &code_challenge_method=S256
```

The user sees a consent screen naming your app, and approves. OpenHosting
redirects back to your `redirect_uri` with `?code=…&state=…`.

For remote MCP, request one or more allowed `mcp:tool:*` scopes and also send
`resource=https://your-host/api/mcp`. OpenHosting displays every requested scope
on the consent screen.

**3. Exchange the code for a token:**

```bash
curl -X POST https://your-host/oauth/token \
  -d grant_type=authorization_code \
  -d code=<code> \
  -d client_id=ohc_… \
  -d client_secret=ohs_… \
  -d redirect_uri=https://app.example.com/callback \
  -d code_verifier=<original-verifier>
```

Response:

```json
{
  "access_token": "oht_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "ohr_…",
  "scope": "openid profile email"
}
```

Public clients omit `client_secret`. MCP exchanges repeat the exact `resource`
parameter. Refresh with `grant_type=refresh_token`, the current refresh token,
client authentication, and the same resource; every refresh rotates both
tokens.

**4. Fetch the user's profile:**

```bash
curl https://your-host/oauth/userinfo \
  -H "Authorization: Bearer oht_…"
```

```json
{
  "sub": "cku…",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Jane Doe",
  "given_name": "Jane",
  "family_name": "Doe"
}
```

## Security notes

- Authorization codes are single-use and expire after 10 minutes.
- Every authorization-code flow requires S256 PKCE.
- Redirect URIs must match a registered value exactly.
- Client secrets and tokens are stored as SHA-256 hashes.
- Access tokens last one hour; rotating refresh tokens last 30 days.
- MCP access tokens are bound to the exact `/api/mcp` resource and exact tool
  scopes. They cannot be reused for a sibling tool or a different audience.
- Authorization Server Metadata is published at
  `/.well-known/oauth-authorization-server`; MCP resource metadata is published
  at `/.well-known/oauth-protected-resource`.
