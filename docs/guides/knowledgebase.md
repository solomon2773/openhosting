# Knowledgebase

The knowledgebase is a self-service help center — public articles organized into
categories, with search — reducing the support tickets your team handles.

## Managing content

Under **Admin → Knowledgebase** you manage:

- **Categories** — name, slug, description, sort order
- **Articles** — title, category, body (plain text or basic HTML), and a
  published flag (drafts stay hidden)

## On the storefront

Published articles appear at `/kb`, linked as **Knowledgebase** in the
storefront navigation. Visitors can:

- Browse articles grouped by category
- **Search** across article titles and bodies
- Read an article at `/kb/<slug>`

Each article tracks a **view count**, so you can see what's most useful and
surface popular articles first in search.

## API

Published articles are available read-only via the REST API — see
[REST API](../api/rest-api.md) (`knowledgebase:read` scope). This lets you embed
articles in other apps or a status page.
