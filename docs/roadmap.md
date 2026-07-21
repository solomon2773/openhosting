# Roadmap — the AI era

OpenHosting's direction: become the first hosting-billing platform built *for*
the agent economy — where AI assistants can run the business, AI agents can be
customers, and AI does the support work — all on open standards (MCP, ACP,
x402) with scoped-permission safety, bring-your-own model keys, and
human-in-the-loop defaults.

**Foundations already shipped:** the [MCP server](mcp.md) (21 tools), the
scoped [REST API](api/rest-api.md), an [OAuth2 provider](api/oauth.md),
[usage-metered billing](guides/metered-billing.md), the
[knowledgebase](guides/knowledgebase.md), the
[fraud pipeline](guides/fraud.md), and the idempotent
[billing cron](billing/automation.md).

Interested in any of these? Comment on the tracking issues or open a
[discussion](https://github.com/solomon2773/openhosting/discussions) —
contributions and design feedback shape the ordering.

## Phase 1 — "AI runs your support" (target v0.4)

1. **AI support agent** — knowledgebase-grounded answers to tickets:
   auto-drafted replies for staff review (the default), optional auto-resolve
   for tier-1 questions with confidence thresholds, and auto-triage
   (department/priority) on ticket creation. Bring-your-own LLM key
   (Anthropic first), per-feature toggles. Industry benchmarks put AI-first
   support at 60–80% deflection at a fraction of human cost — for
   ticket-heavy, thin-margin hosting businesses this is the single biggest
   cost lever.
2. **Customer-facing assistant** — a scoped chat in the client area grounded
   in the knowledgebase *plus the customer's own services and invoices*
   (read-only), with an "escalate to ticket" handoff.
3. **MCP v2: remote & trusted** — streamable-HTTP transport secured by the
   built-in OAuth provider so hosted AI clients connect without a local
   install; per-key *tool-level* scoping in the admin UI; listing in the MCP
   Registry.
4. **`llms.txt` + AI-readable docs** — so AI assistants answer OpenHosting
   questions accurately.

## Phase 2 — "AI agents as customers" (target v0.5)

5. **Agent checkout API** — a first-class machine purchase flow:
   machine-readable catalog feed, idempotent order placement, delegated
   purchase tokens with spend caps and product allow-lists, full audit trail.
   The fraud pipeline gains an "agent buyer" lane instead of treating all
   automation as abuse.
6. **Agentic Commerce Protocol (ACP)** — expose catalog + checkout in ACP
   shape through the Stripe gateway, so purchases can complete natively
   inside AI surfaces (ChatGPT, Gemini) as that channel opens to services.
7. **x402 machine payments** — a gateway driver accepting stablecoin
   per-use payments (HTTP 402 flow); pairs with metered billing for true
   pay-per-request / pay-per-hour infrastructure resale.
8. **Admin copilot** — a chat panel inside the admin that uses OpenHosting's
   own MCP tools internally ("who's likely to churn this month?", "draft a
   quote for X", "why did this provisioning job fail?") with confirmation on
   every write action.

## Phase 3 — "AI in the engine room" (v0.6+)

9. **Revenue & risk intelligence** — churn-risk scoring, usage-anomaly
   detection, LLM-written weekly business summaries; the fraud review queue
   gains AI case summaries explaining *why* an order was flagged.
10. **AI migration assistant** — LLM-assisted schema mapping to import from
    *any* panel export (CSV/SQL), beyond the built-in WHMCS/Paymenter
    importers.
11. **Provisioning auto-remediation** — when a driver call fails, an agent
    reads the audit log, retries with corrected parameters, or files a
    diagnosed ticket for the operator.
12. **GPU / AI-infra reseller pack** — hourly and GPU-metered billing
    presets plus token-usage metering, targeting the fastest-growing hosting
    segment: AI compute resale.

## Principles (constant across all phases)

- **BYO keys, no lock-in** — operators plug in their own model provider;
  every AI feature degrades gracefully to manual.
- **Scoped-permission safety** — AI capability is bounded by API-key and
  tool scopes, never by trust.
- **Human-in-the-loop by default** — automatic actions are opt-in, with
  thresholds and a full audit trail.
- **Open standards over proprietary** — MCP, ACP, x402.

---

*This roadmap reflects market direction as of mid-2026 (MCP mainstream in
enterprise AI stacks; the Agentic Commerce Protocol live across major
platforms; machine-payment volume growing rapidly). Ordering may shift with
user demand — tell us what you need first.*
