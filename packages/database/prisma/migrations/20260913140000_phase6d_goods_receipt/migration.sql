-- CreateTable
CREATE TABLE "GoodsReceipt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "idempotencyPayloadHash" TEXT,
    "notes" TEXT,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReceiptLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "goodsReceiptId" TEXT NOT NULL,
    "purchaseOrderLineId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantityReceived" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoodsReceiptLine_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GoodsReceiptLine_quantityReceived_positive" CHECK ("quantityReceived" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceipt_organizationId_id_key" ON "GoodsReceipt"("organizationId", "id");
CREATE UNIQUE INDEX "GoodsReceipt_organizationId_receiptNumber_key" ON "GoodsReceipt"("organizationId", "receiptNumber");
CREATE UNIQUE INDEX "GoodsReceipt_organizationId_idempotencyKey_key" ON "GoodsReceipt"("organizationId", "idempotencyKey");
CREATE INDEX "GoodsReceipt_organizationId_idx" ON "GoodsReceipt"("organizationId");
CREATE INDEX "GoodsReceipt_organizationId_purchaseOrderId_idx" ON "GoodsReceipt"("organizationId", "purchaseOrderId");
CREATE INDEX "GoodsReceipt_organizationId_warehouseId_idx" ON "GoodsReceipt"("organizationId", "warehouseId");
CREATE INDEX "GoodsReceipt_organizationId_receivedAt_idx" ON "GoodsReceipt"("organizationId", "receivedAt");
CREATE INDEX "GoodsReceipt_organizationId_idempotencyKey_idx" ON "GoodsReceipt"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReceiptLine_organizationId_id_key" ON "GoodsReceiptLine"("organizationId", "id");
CREATE INDEX "GoodsReceiptLine_organizationId_idx" ON "GoodsReceiptLine"("organizationId");
CREATE INDEX "GoodsReceiptLine_organizationId_goodsReceiptId_idx" ON "GoodsReceiptLine"("organizationId", "goodsReceiptId");
CREATE INDEX "GoodsReceiptLine_organizationId_purchaseOrderLineId_idx" ON "GoodsReceiptLine"("organizationId", "purchaseOrderLineId");
CREATE INDEX "GoodsReceiptLine_organizationId_productId_idx" ON "GoodsReceiptLine"("organizationId", "productId");

-- AddForeignKey
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_organizationId_purchaseOrderId_fkey" FOREIGN KEY ("organizationId", "purchaseOrderId") REFERENCES "PurchaseOrder"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_organizationId_warehouseId_fkey" FOREIGN KEY ("organizationId", "warehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_organizationId_goodsReceiptId_fkey" FOREIGN KEY ("organizationId", "goodsReceiptId") REFERENCES "GoodsReceipt"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_organizationId_purchaseOrderLineId_fkey" FOREIGN KEY ("organizationId", "purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GoodsReceiptLine" ADD CONSTRAINT "GoodsReceiptLine_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
