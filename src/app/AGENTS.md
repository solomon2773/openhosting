# App Router guidance

This file applies to `src/app`.

## Responsibilities

- Pages and layouts are Server Components by default. Keep them focused on
  authorization, reads, and rendering.
- Put browser-facing mutations in a domain Server Action under
  `src/lib/actions`; put reusable workflows in `src/lib/services`.
- Route handlers are reserved for REST resources, gateway webhooks, the billing
  cron, OAuth, verification, referrals, and authorized file delivery.
- The root layout uses `dynamic = "force-dynamic"`. Do not introduce build-time
  database access or static rendering assumptions without redesigning that
  constraint explicitly.

## Access control

- Dashboard pages require `requireUser()` and must scope customer-owned records
  to that user.
- Admin pages/actions require `requireAdmin()` with the narrowest existing
  permission that fits the feature.
- API v1 handlers use `withApiKey()` and an explicit read/write scope. Return
  JSON errors consistently and validate request bodies with Zod.
- Attachment routes must check that the requesting user owns the ticket or has
  appropriate staff access before returning database bytes.

## Mutations and rendering

- Revalidate affected paths after a successful mutation, or redirect to a page
  that reads the new state.
- Do not call concrete extension drivers from a page, action, or route. Use the
  relevant service boundary.
- Use settings helpers for configurable behavior and `getT()` for areas already
  localized. Keep user-visible errors specific without exposing credentials or
  provider response bodies.
- Add audit records to security-sensitive and lifecycle-changing mutations.
