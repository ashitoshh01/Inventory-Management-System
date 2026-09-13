-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "idempotencyPayloadHash" TEXT,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "shippedById" TEXT,
    "shippedAt" TIMESTAMP(3),
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_idx" ON "StockTransfer"("organizationId");

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_status_idx" ON "StockTransfer"("organizationId", "status");

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_sourceWarehouseId_idx" ON "StockTransfer"("organizationId", "sourceWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_destinationWarehouseId_idx" ON "StockTransfer"("organizationId", "destinationWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_organizationId_createdAt_idx" ON "StockTransfer"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_organizationId_id_key" ON "StockTransfer"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_organizationId_transferNumber_key" ON "StockTransfer"("organizationId", "transferNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_organizationId_idempotencyKey_key" ON "StockTransfer"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "StockTransferLine_organizationId_idx" ON "StockTransferLine"("organizationId");

-- CreateIndex
CREATE INDEX "StockTransferLine_organizationId_transferId_idx" ON "StockTransferLine"("organizationId", "transferId");

-- CreateIndex
CREATE INDEX "StockTransferLine_organizationId_productId_idx" ON "StockTransferLine"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "StockTransferLine_organizationId_createdAt_idx" ON "StockTransferLine"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferLine_organizationId_id_key" ON "StockTransferLine"("organizationId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransferLine_organizationId_transferId_productId_key" ON "StockTransferLine"("organizationId", "transferId", "productId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_organizationId_sourceWarehouseId_fkey" FOREIGN KEY ("organizationId", "sourceWarehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_organizationId_destinationWarehouseId_fkey" FOREIGN KEY ("organizationId", "destinationWarehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_shippedById_fkey" FOREIGN KEY ("shippedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_organizationId_transferId_fkey" FOREIGN KEY ("organizationId", "transferId") REFERENCES "StockTransfer"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraints
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_source_diff_dest" CHECK ("sourceWarehouseId" <> "destinationWarehouseId");
ALTER TABLE "StockTransferLine" ADD CONSTRAINT "StockTransferLine_quantity_positive" CHECK ("quantity" > 0);
