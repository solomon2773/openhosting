# Reverse proxy & SSL

OpenHosting listens on plain HTTP (port 3000). In production you put a reverse
proxy in front of it to terminate TLS, and set **Admin → Settings → Public
URL** to your `https://` address so emails and payment redirects are correct.

## Caddy (automatic HTTPS)

The simplest option — Caddy fetches and renews certificates automatically:

```
billing.example.com {
    reverse_proxy localhost:3000
}
```

## nginx + Let's Encrypt

```nginx
server {
    listen 80;
    server_name billing.example.com;
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    server_name billing.example.com;

    ssl_certificate     /etc/letsencrypt/live/billing.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/billing.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Obtain the certificate with [certbot](https://certbot.eff.org):

```bash
certbot --nginx -d billing.example.com
```

## Traefik

If you run the Docker stack behind Traefik, add labels to the `app` service in
`docker-compose.yml`:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.oh.rule=Host(`billing.example.com`)"
  - "traefik.http.routers.oh.tls.certresolver=le"
  - "traefik.http.services.oh.loadbalancer.server.port=3000"
```

## Important: forwarded headers

OpenHosting reads the client IP from `X-Forwarded-For` for the audit log and
[fraud checks](../guides/fraud.md) (velocity limits, ban lists). Make sure your
proxy sets it, as shown above. Without it, all requests appear to come from the
proxy's own IP.

## Kubernetes

On Kubernetes, TLS is handled by the Ingress + cert-manager — see
[Deploy on Kubernetes](kubernetes.md).
