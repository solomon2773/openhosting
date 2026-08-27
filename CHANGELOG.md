# Changelog

Notable changes to OpenHosting are documented here. The project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.6.0] — 2026-08-27

### Added

- Agent-native commerce discovery, bounded purchase grants, idempotent native
  checkout, ACP 2026-04-17 checkout sessions, and exact USDC settlement through
  x402 v2.
- Asset-aware money handling with six-decimal USDC support, network and asset
  allowlists, durable settlement records, and metered-service compatibility.
- Knowledgebase-grounded support reply drafts, automatic ticket triage,
  guarded tier-1 resolution, and a read-only customer assistant with ticket
  escalation.
- OAuth-secured remote MCP transport with per-tool scopes and discovery
  metadata.
- S3-compatible ticket attachment storage with presigned access and local
  storage fallback.
- System-aware dark mode with an explicit light, dark, or system preference.
- Billing lifecycle integration coverage and a reusable provisioning-driver
  certification harness.
- Detailed codebase, operator, extension, AI-support, agent-commerce, and
  contributor documentation.

### Changed

- Expanded the root README's agent-commerce positioning and made the autonomous
  commerce roadmap its final section.
- Reframed future automation around policy-governed autonomy: normal low-risk
  operations complete machine-to-machine, while people manage policy and
  exceptions.
- Defined phased delivery and production-readiness criteria for autonomous
  account creation, treasury, purchasing, service management, recovery, and
  multi-agent governance.

### Upgrade notes

- This release contains database migrations for AI extensions, attachment
  storage, AI support, remote MCP/OAuth, USDC money fields, and agent commerce.
  Apply migrations before starting the new application version; the supported
  installer and container entrypoint do this automatically.
- Anthropic, S3-compatible storage, remote MCP, ACP, and x402 remain optional
  and require operator configuration before use.
- USDC is seeded disabled. Verify the network, official asset identifier,
  facilitator, and receiving wallet on testnet before enabling mainnet
  settlement.
- No intentionally breaking REST, CLI, or human-checkout changes are included.

[Unreleased]: https://github.com/solomon2773/openhosting/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/solomon2773/openhosting/compare/v0.5.1...v0.6.0
