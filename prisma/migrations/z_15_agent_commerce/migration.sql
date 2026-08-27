CREATE TABLE "AgentGrant" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "allowedProductIds" JSONB NOT NULL DEFAULT '[]',
  "allowedCurrencies" JSONB NOT NULL DEFAULT '[]',
  "maxPerOrderBase" DECIMAL(20,8) NOT NULL,
  "spendLimitBase" DECIMAL(20,8) NOT NULL,
  "committedBase" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentGrant_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "AgentCheckoutStatus" AS ENUM (
  'DRAFT',
  'PROCESSING',
  'PAYMENT_PENDING',
  'PAID',
  'CANCELED',
  'FAILED'
);

CREATE TABLE "AgentCheckout" (
  "id" TEXT NOT NULL,
  "grantId" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "request" JSONB NOT NULL,
  "status" "AgentCheckoutStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL,
  "amount" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "baseAmount" DECIMAL(20,8) NOT NULL DEFAULT 0,
  "orderId" TEXT,
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentCheckout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentCheckoutOperation" (
  "id" TEXT NOT NULL,
  "checkoutId" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "response" JSONB,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentCheckoutOperation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentGrant_tokenHash_key" ON "AgentGrant"("tokenHash");
CREATE INDEX "AgentGrant_userId_revokedAt_idx" ON "AgentGrant"("userId", "revokedAt");
CREATE UNIQUE INDEX "AgentCheckout_orderId_key" ON "AgentCheckout"("orderId");
CREATE UNIQUE INDEX "AgentCheckout_invoiceId_key" ON "AgentCheckout"("invoiceId");
CREATE UNIQUE INDEX "AgentCheckout_grantId_protocol_idempotencyKey_key"
ON "AgentCheckout"("grantId", "protocol", "idempotencyKey");
CREATE INDEX "AgentCheckout_grantId_status_idx" ON "AgentCheckout"("grantId", "status");
CREATE UNIQUE INDEX "AgentCheckoutOperation_checkoutId_operation_idempotencyKey_key"
ON "AgentCheckoutOperation"("checkoutId", "operation", "idempotencyKey");

ALTER TABLE "AgentGrant"
ADD CONSTRAINT "AgentGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentCheckout"
ADD CONSTRAINT "AgentCheckout_grantId_fkey"
FOREIGN KEY ("grantId") REFERENCES "AgentGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentCheckoutOperation"
ADD CONSTRAINT "AgentCheckoutOperation_checkoutId_fkey"
FOREIGN KEY ("checkoutId") REFERENCES "AgentCheckout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "X402SettlementStatus" AS ENUM ('VERIFYING', 'SETTLED', 'FAILED');

CREATE TABLE "X402Settlement" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "paymentSignatureHash" TEXT NOT NULL,
  "requirementsHash" TEXT NOT NULL,
  "status" "X402SettlementStatus" NOT NULL DEFAULT 'VERIFYING',
  "network" TEXT NOT NULL,
  "transaction" TEXT,
  "payer" TEXT,
  "response" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "X402Settlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "X402Settlement_invoiceId_key" ON "X402Settlement"("invoiceId");
CREATE UNIQUE INDEX "X402Settlement_paymentSignatureHash_key" ON "X402Settlement"("paymentSignatureHash");
CREATE UNIQUE INDEX "X402Settlement_network_transaction_key" ON "X402Settlement"("network", "transaction");

ALTER TABLE "X402Settlement"
ADD CONSTRAINT "X402Settlement_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
