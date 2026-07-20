# Deploy on Kubernetes

Manifests live in [`deploy/k8s/`](../../deploy/k8s):

| File | Purpose |
|---|---|
| `namespace.yaml` | The `openhosting` namespace |
| `secret.example.yaml` | Template for DB URLs + cron secret |
| `deployment.yaml` | 2 replicas, migration init-container, health probes |
| `service.yaml` | ClusterIP service on port 80 |
| `ingress.yaml` | nginx ingress + cert-manager TLS |
| `hpa.yaml` | Autoscale 2–10 replicas at 70% CPU |
| `cronjob.yaml` | Hourly billing tick |

## Install

```bash
# 1. Build & push the image
docker build -t ghcr.io/<you>/openhosting:latest .
docker push ghcr.io/<you>/openhosting:latest

# 2. Namespace + secrets
kubectl apply -f deploy/k8s/namespace.yaml
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml   # edit values
kubectl apply -f deploy/k8s/secret.yaml

# 3. Deploy (update the image refs in deployment.yaml + cronjob.yaml first)
kubectl apply -f deploy/k8s/
```

## How it works

- **Migrations** run in an init-container, so app pods only start once the
  schema is current. Replicas skip migrations via `SKIP_MIGRATIONS=true`.
- **Stateless app.** Sessions live in Postgres, so the HorizontalPodAutoscaler
  can scale freely — no sticky sessions needed.
- **Billing cron.** The `CronJob` posts to `/api/cron` hourly with the shared
  secret; see [Billing automation](../billing/automation.md).
- **Database.** Use a managed Postgres (RDS, Cloud SQL, Supabase…). For
  Supabase, use the pooled URL as `DATABASE_URL` and the direct URL as
  `DIRECT_URL` — see [Using Supabase](supabase.md).

Works on EKS, GKE, AKS, DigitalOcean, k3s — nothing cloud-specific.

## TLS

`ingress.yaml` is annotated for [cert-manager](https://cert-manager.io) with a
`letsencrypt-prod` ClusterIssuer. Change the host and `secretName`, and make
sure your issuer exists. If you terminate TLS elsewhere (a cloud load
balancer), drop the ingress and expose the Service directly.

## Scaling notes

- The HPA targets CPU; adjust `deploy/k8s/hpa.yaml` thresholds to taste.
- The billing `CronJob` uses `concurrencyPolicy: Forbid` so overlapping runs
  never double-invoice.
