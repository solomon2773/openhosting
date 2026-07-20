# Contributing

Contributions are welcome — new integrations, bug fixes, translations, docs and
tests all help. This page summarizes the workflow; the canonical version is
[CONTRIBUTING.md](../CONTRIBUTING.md) in the repository root.

## Development setup

```bash
npm install
cp .env.example .env
docker run -d --name oh-db -p 5432:5432 \
  -e POSTGRES_USER=openhosting -e POSTGRES_PASSWORD=openhosting \
  -e POSTGRES_DB=openhosting postgres:18-alpine
npm run db:push && npm run db:seed
npm run dev
```

See [Installation](getting-started/installation.md) for details.

## Before opening a PR

- `npm run typecheck` and `npm run build` must pass (CI enforces both).
- Schema changes need a migration (see [CLI](cli.md)).
- New integrations follow the driver pattern — see
  [Writing an extension](extensions/writing-extensions.md). Note which
  provider/panel version you tested against.
- UI strings on already-localized pages use the `getT()` helper — see
  [Localization](guides/i18n.md).

## Good places to start

The repository's
[good first issues](https://github.com/solomon2773/openhosting/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
are scoped entry points — new locales, additional themes, and new payment
gateways are all self-contained. Field-testing the provisioning and resale
drivers against real panels/accounts is especially valuable.

## Ways to contribute

- **Integrations** — payment gateways, server modules, resale modules
- **Translations** — add a language dictionary
- **Themes** — new color presets
- **Docs** — improve or extend these pages
- **Tests** — the billing engine's logic is a good target
- **Bug reports** — via GitHub issues, with reproduction steps

## Code of conduct

Participation is governed by the
[Code of Conduct](../CODE_OF_CONDUCT.md).
