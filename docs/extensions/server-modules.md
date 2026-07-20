# Server modules

OpenHosting includes 27 server-provisioning integrations. Enable one under
**Admin → Extensions**, then attach it to a product (product edit page →
**Server extension**) and fill in the per-product settings. On payment the
module creates the server; the billing lifecycle then suspends, unsuspends and
terminates it automatically.

Config options with env keys (e.g. `MEMORY`, `CORES`, `DISK`, `DOMAIN`) let
customers pick sizes at checkout — see [Products → config options](../guides/products.md#config-options).

## Game panels

### Pterodactyl (`pterodactyl`)
Panel URL + application API key. Per-product egg, nest, location and resource
limits. Config options map to egg variables.

### Pelican Panel (`pelican`)
The Pterodactyl successor fork; API-compatible, same configuration.

### WISP (`wisp`)
Hosted Pterodactyl fork for game hosts; API-compatible.

### TCAdmin 2 (`tcadmin`)
Game-server panel. TCAdmin URL + API key; per-product package, game and slots.

## VPS & cloud

### Proxmox VE (`proxmox`)
API URL + API token. Per-product node, guest type (QEMU template clone or LXC),
storage and resources. Customer overrides via `CORES`/`MEMORY`/`DISK` options.

### SolusVM (`solusvm`)
Master URL + API key/hash. Per-product virtualization type, node group, plan and
template.

### Convoy (`convoy`)
Panel URL + application API key; per-product node, template and resource limits.

### VirtFusion (`virtfusion`)
Panel URL + API token; per-product package, hypervisor group and OS template.

### Virtualizor (`virtualizor`)
Panel URL + admin API key/pass; per-product virtualization type, node, plan and
OS.

### Hetzner Cloud (`hetzner`)
API token; per-product server type, image and location. Suspend = power off.

### DigitalOcean (`digitalocean`)
API token; per-product droplet size, image and region.

### Vultr (`vultr`)
API key; per-product plan, OS and region.

### Linode (`linode`)
API token; per-product instance type, image and region.

## Enterprise virtualization

### OpenStack (`openstack`)
Keystone auth URL + credentials + project; per-product flavor, image and
network. Suspend/resume via Nova server actions.

### Virtuozzo (`virtuozzo`)
OpenStack-compatible Hybrid Infrastructure. Same shape as OpenStack.

### OnApp (`onapp`)
Control panel URL + API user email + key; per-product template, hypervisor group
and resources.

### VMware vCloud Director (`vmware-vcloud`)
vCloud URL + org credentials; per-product vDC, vApp template and network.

## Web panels

### cPanel/WHM (`cpanel`)
WHM URL + username + API token; per-product package. Add a `DOMAIN` config
option for the customer's domain.

### DirectAdmin (`directadmin`)
Panel URL + admin username + login key; per-product package and IP.

### Plesk (`plesk`)
Plesk URL + API key (or admin credentials); per-product service plan and IP.

### Enhance (`enhance`)
API URL + org ID + access token; per-product plan.

### HestiaCP (`hestiacp`)
Panel URL + access/secret keys (or admin credentials); per-product package.

### CyberPanel (`cyberpanel`)
Panel URL + admin credentials; per-product package and PHP version.

### CentOS Web Panel (`cwp`)
Server URL + API key; per-product package and server IP.

### InterWorx (`interworx`)
NodeWorx URL + API key; per-product SiteWorx plan and IP.

### ISPConfig (`ispconfig`)
Panel URL + remote API credentials; per-product server ID and IP.

### Webmin/Virtualmin (`webmin`)
Webmin URL + credentials; per-product plan, template and feature set. Add a
`DOMAIN` config option.

## Lifecycle hooks

Every server module implements four hooks the billing engine calls:
`create`, `suspend`, `unsuspend`, `terminate`. Provisioning failures are
recorded in the audit log without blocking billing. Add your own in ~130 lines —
see [Writing an extension](writing-extensions.md).

> **Note:** the driver implementations follow each vendor's documented API. As
> with any provisioning integration, validate against your actual panel version
> in staging before relying on it in production.
