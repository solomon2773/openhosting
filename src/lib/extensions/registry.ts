import "server-only";
import { db } from "@/lib/db";
import type { GatewayDriver, ServerDriver } from "@/lib/extensions/types";
import { stripeGateway } from "@/lib/extensions/gateways/stripe";
import { paypalGateway } from "@/lib/extensions/gateways/paypal";
import { mollieGateway } from "@/lib/extensions/gateways/mollie";
import { bankTransferGateway } from "@/lib/extensions/gateways/bank-transfer";
import { pterodactylServer } from "@/lib/extensions/servers/pterodactyl";
import { convoyServer } from "@/lib/extensions/servers/convoy";
import { virtFusionServer } from "@/lib/extensions/servers/virtfusion";
import { cpanelServer } from "@/lib/extensions/servers/cpanel";
import { directAdminServer } from "@/lib/extensions/servers/directadmin";
import { virtualizorServer } from "@/lib/extensions/servers/virtualizor";
import { pleskServer } from "@/lib/extensions/servers/plesk";
import { enhanceServer } from "@/lib/extensions/servers/enhance";

export const GATEWAY_DRIVERS: GatewayDriver[] = [
  stripeGateway,
  paypalGateway,
  mollieGateway,
  bankTransferGateway,
];

export const SERVER_DRIVERS: ServerDriver[] = [
  pterodactylServer,
  convoyServer,
  virtFusionServer,
  cpanelServer,
  directAdminServer,
  virtualizorServer,
  pleskServer,
  enhanceServer,
];

export function getGatewayDriver(slug: string): GatewayDriver | undefined {
  return GATEWAY_DRIVERS.find((d) => d.slug === slug);
}

export function getServerDriver(slug: string): ServerDriver | undefined {
  return SERVER_DRIVERS.find((d) => d.slug === slug);
}

// Ensure every known driver has an Extension row so it can be configured.
export async function syncExtensions() {
  for (const driver of GATEWAY_DRIVERS) {
    await db.extension.upsert({
      where: { slug: driver.slug },
      update: {},
      create: { slug: driver.slug, name: driver.name, type: "GATEWAY" },
    });
  }
  for (const driver of SERVER_DRIVERS) {
    await db.extension.upsert({
      where: { slug: driver.slug },
      update: {},
      create: { slug: driver.slug, name: driver.name, type: "SERVER" },
    });
  }
}

export async function enabledGateways() {
  return db.extension.findMany({
    where: { type: "GATEWAY", enabled: true },
    orderBy: { name: "asc" },
  });
}
