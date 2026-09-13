-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN "idempotencyKey" TEXT,
ADD COLUMN "idempotencyPayloadHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_organizationId_idempotencyKey_key" ON "PurchaseOrder"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_idempotencyKey_idx" ON "PurchaseOrder"("organizationId", "idempotencyKey");
