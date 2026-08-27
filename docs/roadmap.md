# Roadmap — autonomous hosting commerce

OpenHosting's direction is to become the open hosting-billing platform where AI
agents can be customers as well as operators. The normal path should be fully
machine-to-machine: discover, enroll, quote, pay, provision, operate, renew, and
exit. People define the rules and handle genuine exceptions instead of acting
as mandatory intermediaries.

The public summary, end-to-end customer journey, and production-readiness gates
are the final section of the [root README](../README.md#roadmap). This document
tracks delivery order and concrete outputs.

## Shipped foundation — v0.6

- Knowledgebase-grounded support drafts, triage, confidence-gated tier-1
  resolution, and a read-only customer assistant.
- Remote MCP over streamable HTTP, OAuth protection, and per-tool scopes.
- Machine-readable commerce discovery and catalog endpoints.
- Delegated agent grants with expiry, product and currency allowlists,
  per-order limits, cumulative budgets, audit records, and revocation.
- Idempotent native checkout and ACP 2026-04-17 checkout sessions.
- Exact USDC settlement through x402 v2, durable settlement records, and
  asset-aware metered billing.
- S3-compatible support attachments, provisioning-driver certification,
  billing integration tests, and container CI.

The v0.6 agent flow is intentionally delegated: an existing customer creates a
grant for an agent. The next phases remove that prerequisite without weakening
the limits already enforced by checkout.

## v0.7 — autonomous identity and account creation

### Deliverables

1. Add agent principals and accounts that do not require an email address,
   password, browser session, or pre-existing human owner.
2. Add a challenge-response enrollment API that binds the account to a public
   key. Treat OAuth client credentials, workload identity, W3C DID, and SPIFFE
   as adapters to one internal principal model.
3. Add operator enrollment policies for product, region, payment network,
   rate, service-count, exposure, and account-lifetime limits.
4. Allow pseudonymous enrollment for eligible policies. Request identity or
   compliance evidence only when a configured rule requires it.
5. Add progressive trust tiers driven by successful settlements, account age,
   disputes, abuse signals, and service history.
6. Add multiple keys, proof-of-control rotation, immediate revocation, recovery
   guardians, ownership transfer, and inactivity succession.
7. Add encrypted secret delivery so account and service credentials can be
   recovered without appearing in model context or application logs.

### Exit criteria

- A clean client can enroll, authenticate, rotate a key, and close or recover
  its account using documented machine interfaces.
- A new principal receives the exact policy selected by the operator and
  cannot expand it by changing identity adapters.
- Losing one runtime or key does not strand the account, while a third party
  cannot claim it through recovery alone.

## v0.8 — autonomous treasury and purchasing

### Deliverables

1. Add signed, expiring quotes and capacity reservations.
2. Unify prepaid balance, self-funded USDC, delegated fiat, credits, refunds,
   and adjustments in an asset-aware treasury view.
3. Add standing policies for renewal, usage bursts, scaling, and remediation so
   a human approval is not required inside an already approved envelope.
4. Model pending and final settlement, authorization expiry, underpayment,
   overpayment, refunds, chargebacks, and blockchain reorganization.
5. Refund only through verified payment routes and record the complete link
   between quote, authorization, settlement, invoice, order, and service.
6. Coordinate purchase and provisioning through durable workflow state and an
   outbox, with idempotent replay after crashes.
7. Publish authenticated lifecycle events and webhooks so agents can subscribe
   instead of polling.

### Exit criteria

- Enrollment through usable infrastructure completes without a browser or
  operator on the low-risk path.
- Retries and concurrent workers cannot create duplicate charges, duplicate
  infrastructure, or spend beyond policy.
- Failed and expired purchases converge to a documented state with a safe
  retry, refund, or exception path.

## v0.9 — autonomous service management

### Deliverables

1. Expose renew, resize, upgrade, downgrade, reinstall, restart, cancel,
   snapshot, restore, credential rotation, DNS, and usage through REST and MCP.
2. Integrate external secret managers and public-key-encrypted credential
   envelopes.
3. Add balance and usage forecasting, automatic top-up requests, budget-aware
   scaling, and configurable graceful shutdown before funds run out.
4. Continuously score provider health using the certification harness and add
   bounded retry, failover, rollback, and diagnosed escalation.
5. Allow the support agent to gather approved diagnostics and run reversible
   remediations before creating an exception case.
6. Export portable receipts, invoices, usage evidence, backups, DNS records,
   and service configuration.

### Exit criteria

- A service can run through purchase, renewal, modification, incident, and
  cancellation without routine staff action.
- Secrets never enter prompts, webhooks, audit metadata, or plaintext recovery
  records.
- Automation stops safely and explains the blocking policy when confidence,
  budget, provider health, or compliance requirements are not satisfied.

## v1.0 candidate — multi-agent operations and governance

### Deliverables

1. Add attenuated capability delegation for purchasing, operations, finance,
   and support sub-agents.
2. Add organizations, machine roles, quorum policies, treasury separation, and
   time-bounded emergency access.
3. Add a dry-run policy simulator that reports cost, permissions, expected
   state transitions, and blocking rules before execution.
4. Add pluggable tax, sanctions, fraud, provider acceptable-use, and
   jurisdiction policies with structured machine-remediable requirements.
5. Add optional privacy-preserving reputation and verifiable attestations.
6. Add agent quarantine, global and scoped kill switches, tamper-evident audit
   exports, and incident replay.
7. Add executable protocol conformance and autonomy evaluations covering
   replay, overspending, prompt injection, compromised keys, partial failures,
   payment reorganization, and runaway remediation.

### Exit criteria

- Delegates cannot mint broader authority than their parent and every action is
  attributable through the complete delegation chain.
- Operators can explain, simulate, stop, and replay autonomous actions without
  directly managing each normal transaction.
- The production-readiness definition in the
  [README](../README.md#definition-of-done-for-autonomous-accounts) is met.

## Parallel roadmap tracks

- **Admin copilot:** explain revenue, churn, provisioning, support, and risk;
  draft bounded actions; execute only through the same policy engine as other
  agents.
- **Revenue and risk intelligence:** anomaly detection, churn scoring, weekly
  business summaries, and explainable fraud cases.
- **AI migration assistant:** schema mapping for arbitrary panel exports beyond
  the built-in WHMCS and Paymenter importers.
- **GPU and AI infrastructure:** hourly GPU presets, token and accelerator
  metering, capacity discovery, and reservation-aware quotes.
- **Reliability:** high availability, queue operations, backup verification,
  disaster recovery, and safe upgrade/rollback automation.
- **Federation:** signed provider capability documents and portable offers for
  cross-installation discovery without a proprietary marketplace.
- **Model choice:** additional AI providers and local-model support while
  retaining bring-your-own keys and graceful manual fallback.

## Principles

- **Policy-governed autonomy:** routine low-risk actions complete automatically;
  humans receive structured exceptions, not a request to approve everything.
- **Least authority:** every credential, grant, tool, and delegation is scoped,
  expiring, revocable, and auditable.
- **No secret in model context:** private keys, passwords, recovery material,
  and payment credentials stay in dedicated security boundaries.
- **Open standards and replaceable adapters:** ACP, x402, MCP, OAuth, W3C DID,
  SPIFFE, and interoperable events are adapters around stable domain services.
- **Safe replay:** all money and infrastructure mutations are idempotent and
  recoverable after partial failure.
- **Privacy by design:** pseudonymous operation remains possible where policy
  allows; collect evidence only for a stated requirement.
- **Portable exit:** an autonomous customer can reconcile, export, cancel, and
  recover funds or data without vendor lock-in.
