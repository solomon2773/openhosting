# OAuth / SSO provider

OpenHosting can act as an **OAuth2 identity provider**, letting other
applications sign users in with their OpenHosting account (single sign-on). This
is distinct from [API keys](rest-api.md), which authenticate *your* automation.

## Registering a client

Under **Admin → OAuth clients**, create a client with:

- **Application name**
- **Redirect URIs** — one per line, matched exactly

You get a **client ID** and a **client secret** (shown once). The secret is
stored hashed.

## The flow (authorization code)

**1. Send the user to the authorize endpoint:**

```
GET /oauth/authorize?response_type=code
    &client_id=ohc_…
    &redirect_uri=https://app.example.com/callback
    &state=<random>
```

The user sees a consent screen naming your app, and approves. OpenHosting
redirects back to your `redirect_uri` with `?code=…&state=…`.

**2. Exchange the code for a token:**

```bash
curl -X POST https://your-host/oauth/token \
  -d grant_type=authorization_code \
  -d code=<code> \
  -d client_id=ohc_… \
  -d client_secret=ohs_… \
  -d redirect_uri=https://app.example.com/callback
```

Response:

```json
{ "access_token": "oht_…", "token_type": "Bearer", "expires_in": 2592000 }
```

**3. Fetch the user's profile:**

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
- Redirect URIs must match a registered value exactly.
- Client secrets and tokens are stored as SHA-256 hashes.
- Access tokens are valid for 30 days.
