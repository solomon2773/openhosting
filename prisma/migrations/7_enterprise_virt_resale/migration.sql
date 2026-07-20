-- AlterEnum
ALTER TYPE "ExtensionType" ADD VALUE 'RESALE';

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "resaleConfig" JSONB,
ADD COLUMN     "resaleExtensionId" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "resaleData" JSONB;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_resaleExtensionId_fkey" FOREIGN KEY ("resaleExtensionId") REFERENCES "Extension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

