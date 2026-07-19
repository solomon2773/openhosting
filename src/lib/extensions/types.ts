import type { Extension, Invoice, Service, User } from "@prisma/client";

export type ConfigField = {
  key: string;
  label: string;
  type: "text" | "password" | "select" | "checkbox";
  options?: { label: string; value: string }[];
  help?: string;
  required?: boolean;
};

export type PayResult =
  | { type: "redirect"; url: string }
  | { type: "instructions"; html: string };

// A payment gateway driver. `pay` starts a payment for an invoice and either
// redirects the customer to the gateway or shows manual instructions.
export interface GatewayDriver {
  slug: string;
  name: string;
  configFields: ConfigField[];
  pay(
    invoice: Invoice & { user: User },
    config: Record<string, string>,
    urls: { success: string; cancel: string; webhook: string },
  ): Promise<PayResult>;
  // Handle an incoming webhook. Returns the invoice id to mark paid, or null.
  handleWebhook?(
    request: Request,
    config: Record<string, string>,
  ): Promise<{ invoiceId: string; transactionId: string } | null>;
}

// A server-provisioning driver (Pterodactyl, Proxmox, ...). Lifecycle hooks
// are called by the billing engine as services change state.
export interface ServerDriver {
  slug: string;
  name: string;
  configFields: ConfigField[];
  productConfigFields: ConfigField[];
  create(
    service: Service & { user: User },
    config: Record<string, string>,
    productConfig: Record<string, string>,
  ): Promise<string | null>; // returns externalId
  suspend(service: Service, config: Record<string, string>): Promise<void>;
  unsuspend(service: Service, config: Record<string, string>): Promise<void>;
  terminate(service: Service, config: Record<string, string>): Promise<void>;
}

export function extensionConfig(ext: Extension): Record<string, string> {
  return (ext.config ?? {}) as Record<string, string>;
}
