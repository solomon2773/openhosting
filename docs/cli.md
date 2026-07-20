# CLI

OpenHosting ships a command-line tool, `oh`, for managing a deployment from the
terminal. It talks to the deployment's [REST API](api/rest-api.md), so it works
locally or against any remote install.

## Setup

The CLI needs a base URL and an API key (create one under
**Admin → API keys**). Provide them via environment variables:

```bash
export OPENHOSTING_URL="https://billing.example.com"
export OPENHOSTING_API_KEY="oh_xxxxxxxx…"
export OPENHOSTING_CRON_SECRET="…"   # only for `oh cron run`
```

…or save them once:

```bash
oh config set --url https://billing.example.com --api-key oh_… --cron-secret …
oh config show
```

## Running it

From a clone of the repo:

```bash
node cli/oh.mjs <command>       # or: npm run cli -- <command>
```

Installing globally exposes it as `oh`:

```bash
npm install -g .        # or `npm link` in the repo
oh users list
```

It's a zero-dependency Node script (Node 24+), so there's no build step.

## Commands

```
oh users     list [--q <search>] | get <id>
             create --email <e> --password <p> --first <f> --last <l> [--country <c>]
oh products  list
oh categories list
oh orders    list
oh invoices  list [--status <s>] | get <id> | pay <id>
oh services  list [--status <s>] [--user <id>] | get <id>
             suspend <id> | unsuspend <id> | terminate <id>
             usage <id> <quantity> [--desc <text>]
oh coupons   list | create --code <c> --type PERCENT|FIXED --value <n>
oh quotes    list
oh tickets   list
oh kb        search <query>
oh cron      run
```

Add `--json` to any command for raw JSON instead of a table.

## Examples

```bash
# Find a customer and inspect a service
oh users list --q alice
oh services list --user cku123…
oh services get cku456…

# Suspend a service and re-activate it later
oh services suspend cku456…
oh services unsuspend cku456…

# Record metered usage from a script
oh services usage cku456… 12.5 --desc "March bandwidth (GB)"

# Mark an offline payment and run the billing tick
oh invoices pay ckuinv…
oh cron run

# Answer a support question
oh kb search "reset password"
```

## Scopes

The CLI can only do what its API key's [permission scopes](api/rest-api.md)
allow. A read-only key can list and get; write actions
(`create`, `pay`, `suspend`, `usage`, …) need the corresponding `:write` scope.

For letting an AI assistant drive the same operations, see the
[MCP server](mcp.md).
