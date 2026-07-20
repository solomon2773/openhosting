-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('AUTO_APPROVED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BanType" AS ENUM ('EMAIL', 'EMAIL_DOMAIN', 'IP', 'COUNTRY');

-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENT', 'FIXED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('EARNED', 'PAID');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ip" TEXT,
ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'AUTO_APPROVED',
ADD COLUMN     "riskNotes" TEXT,
ADD COLUMN     "riskScore" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "affiliateCommissionType" "CommissionType",
ADD COLUMN     "affiliateCommissionValue" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referredByAffiliateId" TEXT,
ADD COLUMN     "vatId" TEXT,
ADD COLUMN     "vatValidatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BanRule" (
    "id" TEXT NOT NULL,
    "type" "BanType" NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BanRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalEarned" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "visits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateCommission" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'EARNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateCommission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BanRule_type_value_key" ON "BanRule"("type", "value");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_userId_key" ON "Affiliate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_code_key" ON "Affiliate"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredByAffiliateId_fkey" FOREIGN KEY ("referredByAffiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateCommission" ADD CONSTRAINT "AffiliateCommission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

