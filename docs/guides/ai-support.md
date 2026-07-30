# AI support

OpenHosting can draft ticket replies for your staff and classify incoming
tickets, using **your own** API key. Nothing is sent to a model provider unless
you enable a provider and switch a feature on, and nothing an AI writes reaches
a customer without a person pressing send.

## Setting it up

1. **Admin → Extensions → Anthropic (Claude)** — paste an API key from
   [console.anthropic.com](https://console.anthropic.com), pick a model, enable it.
   Usage is billed to your Anthropic account, not to OpenHosting.
2. **Admin → Settings → AI support** — turn on the features you want.

| Extension setting | Purpose |
|---|---|
| API key | Your own key. Stored in the extension's config like any other integration credential. |
| Model | `claude-opus-5` (most capable), `claude-sonnet-5` (balanced) or `claude-haiku-4-5` (cheapest). |
| Reasoning effort | How much the model deliberates. `low` is plenty for support replies; higher costs more tokens. |
| API base URL | Optional. Point this at an Anthropic-compatible proxy or egress gateway if requests must not leave your network directly. |

| Setting | Default | Purpose |
|---|---|---|
| AI reply drafts on tickets | off | Adds a **Draft with AI** button to the staff reply box |
| Draft sign-off | — | Appended verbatim, e.g. `— The support team` |
| Classify new tickets | off | Sets department and priority when a ticket is created |
| Minimum triage confidence | 0.7 | Below this the customer's own choices are kept |

## Reply drafts

On any open ticket in the admin panel, **Draft with AI** fills the reply box with
a suggested answer. Staff edit it and press send exactly as they would with
anything they typed themselves — the draft is never posted on its own, and the
customer never sees it until a human sends it.

The model is given, and told to stay inside:

- every **published** knowledgebase article (unpublished drafts are not policy yet)
- the ticket's own thread, with the customer as one speaker and prior staff replies as the other
- the subject, department, priority and the customer's first name

It is instructed not to invent prices, policies, limits or timelines, and never
to claim an action has been taken — it cannot touch the account, so it says what
will happen next instead. If the knowledgebase does not answer the question, a
good draft says what can be confirmed and hands the ticket over.

**The knowledgebase is the quality lever.** A thin knowledgebase produces vague
drafts. Articles that answer real questions produce drafts staff can send with a
one-line edit.

Every draft is recorded in the [audit log](accounts-security.md#audit-log) as
`admin.ai_reply_drafted` with the staff member who asked for it.

## Ticket classification

With **Classify new tickets** on, each new ticket is read once and its
department and priority are set from its content — useful when customers pick
"General / Low" for an outage. The classification is audited as `ticket.triaged`.

Two deliberate limits:

- **Confidence gate.** The model reports how sure it is; below your threshold
  nothing changes and the customer's own choices stand.
- **Never blocks the ticket.** If the provider is slow, rate-limited or down,
  the failure is swallowed and the ticket is created exactly as submitted. A
  support form that fails because an AI is unavailable would be worse than no
  classification at all.

## Costs and privacy

- You are billed by your provider for the tokens each feature uses. A reply
  draft sends your published knowledgebase plus the ticket thread; a
  classification sends the subject and first message only.
- Ticket content and knowledgebase articles are sent to the provider you
  configured, when a feature runs. Customer passwords, payment details and API
  keys are never part of a prompt.
- Turning the extension off stops all of it immediately — the features check for
  an enabled provider on every call.

## Adding another provider

AI providers are [extension drivers](../extensions/overview.md) like payment
gateways: one file under `src/lib/extensions/ai/` implementing `AiDriver`, one
line in `registry.ts`. The admin form is rendered from the driver's own
`configFields`, and `src/lib/services/ai.ts` is the only module that resolves a
driver — the ticket UI and the triage hook never name one. See
[Writing an extension](../extensions/writing-extensions.md).
