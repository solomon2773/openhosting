import type { ServerDriver } from "@/lib/extensions/types";
import type { Service } from "@/generated/prisma/client";
import { randomBytes } from "node:crypto";

// Proxmox VE via the HTTP API with an API token
// (Datacenter → Permissions → API Tokens; needs VM.* privileges).
// Supports QEMU VMs (full clone from a template) and LXC containers
// (created from an OS template).

async function pve(
  config: Record<string, string>,
  method: string,
  path: string,
  body?: Record<string, string | number>,
) {
  const base = config.host?.replace(/\/$/, "");
  const res = await fetch(`${base}/api2/json${path}`, {
    method,
    headers: {
      Authorization: `PVEAPIToken=${config.token_id}=${config.token_secret}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: body
      ? new URLSearchParams(
          Object.fromEntries(
            Object.entries(body).map(([k, v]) => [k, String(v)]),
          ),
        )
      : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Proxmox ${method} ${path} failed: ${res.status} ${detail}`);
  }
  const data = await res.json().catch(() => null);
  return data?.data ?? null;
}

// Most mutating PVE calls return a task UPID; wait for it to finish.
async function pveWaitTask(
  config: Record<string, string>,
  node: string,
  upid: unknown,
  timeoutMs = 180_000,
): Promise<void> {
  if (typeof upid !== "string" || !upid.startsWith("UPID:")) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await pve(
      config,
      "GET",
      `/nodes/${node}/tasks/${encodeURIComponent(upid)}/status`,
    );
    if (status?.status === "stopped") {
      if (status.exitstatus !== "OK") {
        throw new Error(`Proxmox task failed: ${status.exitstatus}`);
      }
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Proxmox task timed out");
}

// Customer-selected config option values (by env key) override product
// defaults, e.g. a "Memory" option with env key MEMORY.
function overrides(service: Service): Record<string, string> {
  const entries =
    (service.config as Array<{ envKey?: string; value: string }> | null) ?? [];
  return Object.fromEntries(
    entries.filter((e) => e.envKey).map((e) => [e.envKey as string, e.value]),
  );
}

function parseExternalId(
  externalId: string,
): { node: string; type: string; vmid: string } | null {
  const [node, type, vmid] = externalId.split("/");
  if (!node || !type || !vmid) return null;
  return { node, type, vmid };
}

function guestPath(ext: { node: string; type: string; vmid: string }): string {
  return `/nodes/${ext.node}/${ext.type}/${ext.vmid}`;
}

export const proxmoxServer: ServerDriver = {
  slug: "proxmox",
  name: "Proxmox VE",
  configFields: [
    { key: "host", label: "API URL", type: "text", required: true, help: "e.g. https://pve.example.com:8006 (certificate must be trusted)" },
    { key: "token_id", label: "API token ID", type: "text", required: true, help: "user@realm!tokenname" },
    { key: "token_secret", label: "API token secret", type: "password", required: true },
  ],
  productConfigFields: [
    {
      key: "type",
      label: "Guest type",
      type: "select",
      required: true,
      options: [
        { label: "QEMU VM (clone template)", value: "qemu" },
        { label: "LXC container", value: "lxc" },
      ],
    },
    { key: "node", label: "Node name", type: "text", required: true },
    { key: "template_vmid", label: "Template VMID (QEMU)", type: "text", help: "VM template to full-clone" },
    { key: "ostemplate", label: "OS template (LXC)", type: "text", help: "e.g. local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst" },
    { key: "storage", label: "Target storage", type: "text", required: true },
    { key: "cores", label: "CPU cores", type: "text", required: true },
    { key: "memory", label: "Memory (MB)", type: "text", required: true },
    { key: "disk", label: "Disk (GB, LXC rootfs)", type: "text" },
    { key: "bridge", label: "Network bridge", type: "text", help: "Default vmbr0" },
    { key: "pool", label: "Resource pool", type: "text" },
  ],
  async create(service, config, productConfig) {
    const custom = overrides(service);
    const node = productConfig.node;
    const type = productConfig.type === "lxc" ? "lxc" : "qemu";
    const cores = Number(custom.CORES ?? productConfig.cores);
    const memory = Number(custom.MEMORY ?? productConfig.memory);
    const disk = Number(custom.DISK ?? productConfig.disk ?? 8);
    const bridge = productConfig.bridge || "vmbr0";
    const name = `svc-${service.id.slice(-8)}`;

    const vmid = Number(await pve(config, "GET", "/cluster/nextid"));

    if (type === "qemu") {
      const clone = await pve(
        config,
        "POST",
        `/nodes/${node}/qemu/${productConfig.template_vmid}/clone`,
        {
          newid: vmid,
          name,
          full: 1,
          storage: productConfig.storage,
          ...(productConfig.pool ? { pool: productConfig.pool } : {}),
        },
      );
      await pveWaitTask(config, node, clone);
      await pve(config, "POST", `/nodes/${node}/qemu/${vmid}/config`, {
        cores,
        memory,
      });
      await pve(config, "POST", `/nodes/${node}/qemu/${vmid}/status/start`);
    } else {
      const create = await pve(config, "POST", `/nodes/${node}/lxc`, {
        vmid,
        hostname: name,
        ostemplate: productConfig.ostemplate,
        storage: productConfig.storage,
        rootfs: `${productConfig.storage}:${disk}`,
        cores,
        memory,
        password: randomBytes(12).toString("base64url"),
        net0: `name=eth0,bridge=${bridge},ip=dhcp`,
        unprivileged: 1,
        start: 1,
        ...(productConfig.pool ? { pool: productConfig.pool } : {}),
      });
      await pveWaitTask(config, node, create);
    }
    return `${node}/${type}/${vmid}`;
  },
  // Billing suspension = force stop; the guest and its data stay intact.
  async suspend(service, config) {
    const ext = service.externalId && parseExternalId(service.externalId);
    if (!ext) return;
    const stop = await pve(config, "POST", `${guestPath(ext)}/status/stop`);
    await pveWaitTask(config, ext.node, stop);
  },
  async unsuspend(service, config) {
    const ext = service.externalId && parseExternalId(service.externalId);
    if (!ext) return;
    const start = await pve(config, "POST", `${guestPath(ext)}/status/start`);
    await pveWaitTask(config, ext.node, start);
  },
  async terminate(service, config) {
    const ext = service.externalId && parseExternalId(service.externalId);
    if (!ext) return;
    // stop first (ignore failures if already stopped), then destroy + purge
    try {
      const stop = await pve(config, "POST", `${guestPath(ext)}/status/stop`);
      await pveWaitTask(config, ext.node, stop);
    } catch {
      // already stopped or stopping — proceed to destroy
    }
    const destroy = await pve(
      config,
      "DELETE",
      `${guestPath(ext)}?purge=1&destroy-unreferenced-disks=1`,
    );
    await pveWaitTask(config, ext.node, destroy);
  },
};
