import "server-only";
import { db } from "@/lib/db";
import type { GatewayDriver, ServerDriver, ResaleDriver } from "@/lib/extensions/types";
import { stripeGateway } from "@/lib/extensions/gateways/stripe";
import { paypalGateway } from "@/lib/extensions/gateways/paypal";
import { mollieGateway } from "@/lib/extensions/gateways/mollie";
import { bankTransferGateway } from "@/lib/extensions/gateways/bank-transfer";
import { coinbaseCommerceGateway } from "@/lib/extensions/gateways/coinbase-commerce";
import { nowpaymentsGateway } from "@/lib/extensions/gateways/nowpayments";
import { btcpayGateway } from "@/lib/extensions/gateways/btcpay";
import { coingateGateway } from "@/lib/extensions/gateways/coingate";
import { goCardlessGateway } from "@/lib/extensions/gateways/gocardless";
import { squareGateway } from "@/lib/extensions/gateways/square";
import { authorizeNetGateway } from "@/lib/extensions/gateways/authorizenet";
import { braintreeGateway } from "@/lib/extensions/gateways/braintree";
import { lemonSqueezyGateway } from "@/lib/extensions/gateways/lemonsqueezy";
import { razorpayGateway } from "@/lib/extensions/gateways/razorpay";
import { mercadoPagoGateway } from "@/lib/extensions/gateways/mercadopago";
import { paystackGateway } from "@/lib/extensions/gateways/paystack";
import { flutterwaveGateway } from "@/lib/extensions/gateways/flutterwave";
import { midtransGateway } from "@/lib/extensions/gateways/midtrans";
import { xenditGateway } from "@/lib/extensions/gateways/xendit";
import { pterodactylServer } from "@/lib/extensions/servers/pterodactyl";
import { convoyServer } from "@/lib/extensions/servers/convoy";
import { virtFusionServer } from "@/lib/extensions/servers/virtfusion";
import { cpanelServer } from "@/lib/extensions/servers/cpanel";
import { directAdminServer } from "@/lib/extensions/servers/directadmin";
import { virtualizorServer } from "@/lib/extensions/servers/virtualizor";
import { pleskServer } from "@/lib/extensions/servers/plesk";
import { enhanceServer } from "@/lib/extensions/servers/enhance";
import { proxmoxServer } from "@/lib/extensions/servers/proxmox";
import { webminServer } from "@/lib/extensions/servers/webmin";
import { pelicanServer } from "@/lib/extensions/servers/pelican";
import { wispServer } from "@/lib/extensions/servers/wisp";
import { solusvmServer } from "@/lib/extensions/servers/solusvm";
import { tcadminServer } from "@/lib/extensions/servers/tcadmin";
import { hestiaCpServer } from "@/lib/extensions/servers/hestiacp";
import { cyberPanelServer } from "@/lib/extensions/servers/cyberpanel";
import { cwpServer } from "@/lib/extensions/servers/cwp";
import { interworxServer } from "@/lib/extensions/servers/interworx";
import { ispConfigServer } from "@/lib/extensions/servers/ispconfig";
import { hetznerServer } from "@/lib/extensions/servers/hetzner";
import { digitalOceanServer } from "@/lib/extensions/servers/digitalocean";
import { vultrServer } from "@/lib/extensions/servers/vultr";
import { linodeServer } from "@/lib/extensions/servers/linode";
import { openStackServer } from "@/lib/extensions/servers/openstack";
import { onAppServer } from "@/lib/extensions/servers/onapp";
import { virtuozzoServer } from "@/lib/extensions/servers/virtuozzo";
import { vmwareVcloudServer } from "@/lib/extensions/servers/vmware-vcloud";
import { enomResale } from "@/lib/extensions/resale/enom";
import { resellerClubResale } from "@/lib/extensions/resale/resellerclub";
import { namecheapResale } from "@/lib/extensions/resale/namecheap";
import { openSrsResale } from "@/lib/extensions/resale/opensrs";
import { openProviderResale } from "@/lib/extensions/resale/openprovider";
import { goGetSslResale } from "@/lib/extensions/resale/gogetssl";
import { licenseResale } from "@/lib/extensions/resale/licenses";
import { microsoft365Resale } from "@/lib/extensions/resale/microsoft365";
import { googleWorkspaceResale } from "@/lib/extensions/resale/google-workspace";

export const GATEWAY_DRIVERS: GatewayDriver[] = [
  stripeGateway,
  paypalGateway,
  mollieGateway,
  bankTransferGateway,
  coinbaseCommerceGateway,
  nowpaymentsGateway,
  btcpayGateway,
  coingateGateway,
  goCardlessGateway,
  squareGateway,
  authorizeNetGateway,
  braintreeGateway,
  lemonSqueezyGateway,
  razorpayGateway,
  mercadoPagoGateway,
  paystackGateway,
  flutterwaveGateway,
  midtransGateway,
  xenditGateway,
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
  proxmoxServer,
  webminServer,
  pelicanServer,
  wispServer,
  solusvmServer,
  tcadminServer,
  hestiaCpServer,
  cyberPanelServer,
  cwpServer,
  interworxServer,
  ispConfigServer,
  hetznerServer,
  digitalOceanServer,
  vultrServer,
  linodeServer,
  openStackServer,
  onAppServer,
  virtuozzoServer,
  vmwareVcloudServer,
];

export const RESALE_DRIVERS: ResaleDriver[] = [
  enomResale,
  resellerClubResale,
  namecheapResale,
  openSrsResale,
  openProviderResale,
  goGetSslResale,
  licenseResale,
  microsoft365Resale,
  googleWorkspaceResale,
];

export function getGatewayDriver(slug: string): GatewayDriver | undefined {
  return GATEWAY_DRIVERS.find((d) => d.slug === slug);
}

export function getServerDriver(slug: string): ServerDriver | undefined {
  return SERVER_DRIVERS.find((d) => d.slug === slug);
}

export function getResaleDriver(slug: string): ResaleDriver | undefined {
  return RESALE_DRIVERS.find((d) => d.slug === slug);
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
  for (const driver of RESALE_DRIVERS) {
    await db.extension.upsert({
      where: { slug: driver.slug },
      update: {},
      create: { slug: driver.slug, name: driver.name, type: "RESALE" },
    });
  }
}

export async function enabledGateways() {
  return db.extension.findMany({
    where: { type: "GATEWAY", enabled: true },
    orderBy: { name: "asc" },
  });
}
