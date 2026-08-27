# Server driver certification

Bundled means that a driver implements the OpenHosting lifecycle contract; it
does not mean every vendor/version combination has been exercised with live
credentials. A driver is certified only after `create → suspend → unsuspend →
terminate` succeeds against a disposable staging resource.

## Live lifecycle harness

Create a fixture outside the repository so credentials are not committed:

```json
{
  "config": {
    "panel_url": "https://staging-panel.example.com",
    "api_key": "replace-with-a-staging-key"
  },
  "productConfig": {
    "location_id": "1",
    "nest_id": "1",
    "egg_id": "1",
    "docker_image": "ghcr.io/example/image:latest",
    "startup": "./start.sh",
    "memory": "512",
    "disk": "1024",
    "cpu": "100"
  },
  "user": {
    "email": "certification@example.test",
    "firstName": "Driver",
    "lastName": "Test"
  }
}
```

Run the harness only against a sandbox or staging tenant:

```bash
npm run certify:server -- \
  --driver pterodactyl \
  --fixture /secure/path/pterodactyl-certification.json \
  --confirm-live-lifecycle
```

The confirmation flag is mandatory because the command creates and deletes a
real resource. The fixture is validated against the driver's required fields,
credentials are never printed, each stage is timed, and cleanup termination is
attempted if an intermediate stage fails. Keep the staging account isolated and
verify in the provider console that no resource remains after the run.

## Current status

All 27 drivers pass static registry checks for unique slugs, complete lifecycle
hooks, and valid configuration metadata. Live certification requires operator
credentials and is intentionally not claimed by the repository itself. Record a
successful run with provider product/version, date, and any required permission
scope in the tracking issue before changing a driver to field-tested status.
