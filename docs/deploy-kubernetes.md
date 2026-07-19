# Deploying on Kubernetes

Manifests live in [`deploy/k8s/`](../deploy/k8s):

| File | Purpose |
|---|---|
| `namespace.yaml` | `openhosting` namespace |
| `secret.example.yaml` | template for DB URLs + cron secret |
| `deployment.yaml` | 2 replicas, migration initContainer, probes |
| `service.yaml` | ClusterIP service on port 80 |
| `ingress.yaml` | nginx ingress + cert-manager TLS |
| `hpa.yaml` | autoscale 2–10 replicas at 70% CPU |
| `cronjob.yaml` | hourly billing tick |

## Install

```bash
# 1. Build & push the image (or use your registry of choice)
docker build -t ghcr.io/<you>/openhosting:latest .
docker push ghcr.io/<you>/openhosting:latest

# 2. Configure
kubectl apply -f deploy/k8s/namespace.yaml
cp deploy/k8s/secret.example.yaml deploy/k8s/secret.yaml   # edit values
kubectl apply -f deploy/k8s/secret.yaml

# 3. Deploy (update the image refs in deployment.yaml first)
kubectl apply -f deploy/k8s/
```

Notes:

- **Migrations** run in an initContainer, so app pods only start once the
  schema is current; replicas skip migrations via `SKIP_MIGRATIONS=true`.
- **Database**: use a managed Postgres (RDS, Cloud SQL, Supabase, …). For
  Supabase, use the pooled URL as `DATABASE_URL` and the direct URL as
  `DIRECT_URL` — see [supabase.md](supabase.md).
- The app is stateless (sessions live in Postgres), so the HPA can scale
  freely; no sticky sessions required.
- Works on EKS, GKE, AKS, DigitalOcean, k3s — nothing cloud-specific.
