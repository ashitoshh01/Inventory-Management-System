-- CreateEnum
CREATE TYPE "StockLedgerEntryType" AS ENUM ('OPENING', 'RECEIPT', 'ISSUE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "StockBalance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantityDelta" DECIMAL(14,4) NOT NULL,
    "quantityBefore" DECIMAL(14,4) NOT NULL,
    "quantityAfter" DECIMAL(14,4) NOT NULL,
    "type" "StockLedgerEntryType" NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockBalance_organizationId_idx" ON "StockBalance"("organizationId");

-- CreateIndex
CREATE INDEX "StockBalance_organizationId_productId_idx" ON "StockBalance"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "StockBalance_organizationId_warehouseId_idx" ON "StockBalance"("organizationId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_organizationId_productId_warehouseId_key" ON "StockBalance"("organizationId", "productId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_organizationId_idx" ON "StockLedgerEntry"("organizationId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_organizationId_productId_idx" ON "StockLedgerEntry"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_organizationId_warehouseId_idx" ON "StockLedgerEntry"("organizationId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_organizationId_createdAt_idx" ON "StockLedgerEntry"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "StockLedgerEntry_organizationId_productId_warehouseId_creat_idx" ON "StockLedgerEntry"("organizationId", "productId", "warehouseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockLedgerEntry_organizationId_idempotencyKey_key" ON "StockLedgerEntry"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Product_organizationId_id_key" ON "Product"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_organizationId_warehouseId_fkey" FOREIGN KEY ("organizationId", "warehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_organizationId_warehouseId_fkey" FOREIGN KEY ("organizationId", "warehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraints
ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_delta_nonzero" CHECK ("quantityDelta" <> 0);

ALTER TABLE "StockLedgerEntry" ADD CONSTRAINT "StockLedgerEntry_math_consistent" CHECK ("quantityAfter" = "quantityBefore" + "quantityDelta");
