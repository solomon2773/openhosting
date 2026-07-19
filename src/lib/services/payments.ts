import "server-only";
import { db } from "@/lib/db";
import { getGatewayDriver } from "@/lib/extensions/registry";
import { extensionConfig, type PayResult } from "@/lib/extensions/types";
import { getSetting } from "@/lib/settings";
import { markInvoicePaid } from "@/lib/billing";
import { convertToBase } from "@/lib/services/currency";

// Payment service: the only module that resolves and invokes gateway drivers
// (dependency inversion — checkout/webhook code never sees a concrete
// gateway). Credits are handled here as a built-in payment method.

export async function startGatewayPayment(
  invoiceId: string,
  gatewaySlug: string,
): Promise<PayResult> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { user: true },
  });
  if (!invoice) throw new Error("Invoice not found");
  if (invoice.status !== "PENDING") throw new Error("Invoice is not payable");

  const extension = await db.extension.findUnique({
    where: { slug: gatewaySlug },
  });
  if (!extension?.enabled || extension.type !== "GATEWAY") {
    throw new Error("Payment method is not available");
  }
  const driver = getGatewayDriver(gatewaySlug);
  if (!driver) throw new Error("Unknown payment gateway");

  const baseUrl = await getSetting("company_url");
  return driver.pay(invoice, extensionConfig(extension), {
    success: `${baseUrl}/dashboard/invoices/${invoice.id}?paid=1`,
    cancel: `${baseUrl}/dashboard/invoices/${invoice.id}`,
    webhook: `${baseUrl}/api/webhooks/${gatewaySlug}`,
  });
}

export async function payWithCredits(
  invoiceId: string,
  userId: string,
): Promise<{ error?: string }> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || invoice.userId !== userId) {
    return { error: "Invoice not found" };
  }
  if (invoice.status !== "PENDING") return { error: "Invoice is not payable" };

  // credits are held in the base currency; convert foreign-currency invoices
  const baseCurrency = await getSetting("currency");
  const chargeInBase =
    invoice.currency === baseCurrency
      ? Number(invoice.total)
      : await convertToBase(Number(invoice.total), invoice.currency);

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || Number(user.credits) < chargeInBase) {
    return { error: "Insufficient credit balance" };
  }
  await db.user.update({
    where: { id: userId },
    data: { credits: { decrement: chargeInBase } },
  });
  await markInvoicePaid(invoice.id, "credits");
  return {};
}

// ── Stored payment methods / auto-charge ────────────────────────────────────

async function resolveStorableGateway(gatewaySlug: string) {
  const extension = await db.extension.findUnique({
    where: { slug: gatewaySlug },
  });
  if (!extension?.enabled || extension.type !== "GATEWAY") return null;
  const driver = getGatewayDriver(gatewaySlug);
  if (!driver?.createSetupRedirect) return null;
  return { extension, driver };
}

// Gateways (enabled) that support storing payment methods.
export async function storableGateways() {
  const enabled = await db.extension.findMany({
    where: { type: "GATEWAY", enabled: true },
  });
  return enabled.filter((e) => getGatewayDriver(e.slug)?.createSetupRedirect);
}

export async function startPaymentMethodSetup(
  userId: string,
  gatewaySlug: string,
): Promise<string> {
  const resolved = await resolveStorableGateway(gatewaySlug);
  if (!resolved) throw new Error("Gateway does not support stored methods");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");
  const existing = await db.storedPaymentMethod.findFirst({
    where: { userId, gateway: gatewaySlug },
  });
  const baseUrl = await getSetting("company_url");
  const { url } = await resolved.driver.createSetupRedirect!(
    user,
    existing?.customerId ?? null,
    extensionConfig(resolved.extension),
    {
      success: `${baseUrl}/dashboard/account/billing?gateway=${gatewaySlug}`,
      cancel: `${baseUrl}/dashboard/account/billing`,
    },
  );
  return url;
}

export async function completePaymentMethodSetup(
  userId: string,
  gatewaySlug: string,
  sessionRef: string,
): Promise<boolean> {
  const resolved = await resolveStorableGateway(gatewaySlug);
  if (!resolved?.driver.completeSetup) return false;
  const details = await resolved.driver.completeSetup(
    sessionRef,
    extensionConfig(resolved.extension),
  );
  if (!details) return false;
  // avoid duplicates if the success page is reloaded
  const existing = await db.storedPaymentMethod.findFirst({
    where: { userId, gateway: gatewaySlug, methodId: details.methodId },
  });
  if (existing) return true;
  await db.storedPaymentMethod.updateMany({
    where: { userId },
    data: { isDefault: false },
  });
  await db.storedPaymentMethod.create({
    data: {
      userId,
      gateway: gatewaySlug,
      customerId: details.customerId,
      methodId: details.methodId,
      brand: details.brand,
      last4: details.last4,
      expMonth: details.expMonth,
      expYear: details.expYear,
      isDefault: true,
    },
  });
  return true;
}

const MAX_AUTO_CHARGE_ATTEMPTS = 3;

// Off-session charging of due invoices against default stored methods.
// Called from the billing cron.
export async function autoChargeDueInvoices(): Promise<number> {
  const invoices = await db.invoice.findMany({
    where: {
      status: "PENDING",
      dueAt: { lte: new Date() },
      autoChargeAttempts: { lt: MAX_AUTO_CHARGE_ATTEMPTS },
      user: { paymentMethods: { some: { isDefault: true } } },
    },
    include: {
      user: { include: { paymentMethods: { where: { isDefault: true } } } },
    },
  });

  let charged = 0;
  for (const invoice of invoices) {
    const method = invoice.user.paymentMethods[0];
    if (!method) continue;
    const resolved = await resolveStorableGateway(method.gateway);
    if (!resolved?.driver.chargeStored) continue;
    try {
      const result = await resolved.driver.chargeStored(
        invoice,
        { customerId: method.customerId, methodId: method.methodId },
        extensionConfig(resolved.extension),
      );
      if (result) {
        await markInvoicePaid(invoice.id, method.gateway, result.transactionId);
        charged++;
        continue;
      }
    } catch {
      // fall through to attempt counting
    }
    await db.invoice.update({
      where: { id: invoice.id },
      data: { autoChargeAttempts: { increment: 1 } },
    });
  }
  return charged;
}

export async function handleGatewayWebhook(
  request: Request,
  gatewaySlug: string,
): Promise<boolean> {
  const extension = await db.extension.findUnique({
    where: { slug: gatewaySlug },
  });
  if (!extension?.enabled) return false;
  const driver = getGatewayDriver(gatewaySlug);
  if (!driver?.handleWebhook) return false;
  const result = await driver.handleWebhook(
    request,
    extensionConfig(extension),
  );
  if (!result) return false;
  await markInvoicePaid(result.invoiceId, gatewaySlug, result.transactionId);
  return true;
}
