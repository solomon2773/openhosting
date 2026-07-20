# Billing automation

OpenHosting's recurring billing runs from a **single cron endpoint**. There's no
background worker — you call one URL on a schedule and it does everything.

## The cron endpoint

```
POST /api/cron
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` is set in the environment (see the
[environment reference](../getting-started/environment.md)). Each call runs, in
order:

1. **Generate renewal invoices** — for active recurring services expiring within
   the configured window, creates a renewal invoice and emails the customer.
2. **Auto-charge** — for due invoices where the customer has a saved card,
   charges their default payment method off-session.
3. **Cancel end-of-term services** — terminates services the customer scheduled
   to cancel at period end.
4. **Suspend overdue services** — suspends services overdue beyond the grace
   period, calling the provisioning `suspend` hook.
5. **Terminate stale suspensions** — cancels services suspended beyond the
   termination window, calling `terminate`/`cancel`, and voids their open
   invoices.

The response is a JSON summary of counts:

```json
{ "invoicesCreated": 3, "autoCharged": 2, "endOfTermCancelled": 0,
  "suspended": 1, "cancelled": 0 }
```

The run is **idempotent** — safe to call repeatedly; it won't double-invoice.

## Scheduling it

Run it hourly. How depends on your deployment:

- **docker-compose** — the bundled `cron` service already does this.
- **Kubernetes** — the `CronJob` in `deploy/k8s/cronjob.yaml` does this.
- **Anywhere else** — use any scheduler:

```bash
# crontab: every hour
0 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-host/api/cron
```

Vercel Cron, GitHub Actions `schedule`, or a systemd timer work equally well.

## Timing settings

The windows are configured under **Admin → Settings → Billing automation**:

| Setting | Effect |
|---|---|
| Generate renewal invoices (days before due) | How early renewal invoices appear |
| Suspend services (days after due) | Grace period before suspension |
| Terminate services (days after suspension) | How long a suspension lasts before termination |

See [Services](../guides/services.md) for the full lifecycle and
[Orders & invoices](../guides/orders-invoices.md) for how payments activate
services.
