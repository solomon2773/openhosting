import "server-only";
import { db } from "@/lib/db";
import { getGatewayDriver } from "@/lib/extensions/registry";
import { extensionConfig, type PayResult } from "@/lib/extensions/types";
import { getSetting } from "@/lib/settings";
import { markInvoicePaid } from "@/lib/billing";

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

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || Number(user.credits) < Number(invoice.total)) {
    return { error: "Insufficient credit balance" };
  }
  await db.user.update({
    where: { id: userId },
    data: { credits: { decrement: invoice.total } },
  });
  await markInvoicePaid(invoice.id, "credits");
  return {};
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
