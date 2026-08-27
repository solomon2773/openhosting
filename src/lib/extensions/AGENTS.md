# Extension driver guidance

This file applies to payment, server, resale, and AI drivers in
`src/lib/extensions`.

## Contracts and registration

- Implement the appropriate interface from `types.ts`; do not add provider
  policy to a page or to the billing engine.
- Add the driver to the matching array in `registry.ts`. Keep the seed inventory
  and extension documentation in sync when adding or renaming a driver.
- Driver slugs are durable database and URL identifiers. Do not rename one
  without a data migration and compatibility plan.
- Declare operator credentials in `configFields`, product mapping in
  `productConfigFields`, and customer input only in resale `checkoutFields`.

## Boundaries

- Only `services/payments.ts` resolves gateway drivers.
- Only `services/provisioning.ts` resolves server drivers.
- Only `services/resale.ts` resolves resale drivers.
- AI prompt policy and feature flags belong in `services/ai.ts`; AI drivers only
  translate typed requests into provider calls.
- Keep files server-only. Use native `fetch` unless an existing dependency is
  already required and materially improves correctness.

## Lifecycle and safety

- Gateway webhooks must verify the provider signature and payment state before
  returning an invoice/transaction pair. Make repeat delivery safe; invoice
  payment handling is idempotent after an invoice is paid.
- Server create methods return the external resource ID. Suspend, unsuspend,
  and terminate must use the stored `externalId` where the provider requires it.
- Resale provision returns an external reference; renew is optional; cancel is
  required.
- Do not log API keys, secrets, raw webhook signatures, card data, access
  tokens, or full provider payloads. Return operator-actionable error messages.
- Preserve the service layer's failure behavior: external lifecycle failures are
  audited so a provider outage does not silently rewrite billing state.

## Verification

At minimum run `npm run db:generate`, `npm run typecheck`, and `npm run build`.
For a live driver, also exercise the provider's sandbox or test mode, including
signature failure, success, and repeat webhook delivery where applicable.
