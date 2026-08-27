-- Existing attachment rows remain database-backed. New S3-backed rows keep
-- only an object key, so the byte column must become nullable.
ALTER TABLE "TicketAttachment"
ADD COLUMN "storageBackend" TEXT NOT NULL DEFAULT 'database',
ADD COLUMN "storageKey" TEXT,
ALTER COLUMN "data" DROP NOT NULL;

CREATE INDEX "TicketAttachment_storageBackend_storageKey_idx"
ON "TicketAttachment"("storageBackend", "storageKey");
