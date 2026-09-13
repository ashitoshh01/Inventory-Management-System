-- CreateIndex
CREATE INDEX "PurchaseOrder_organizationId_expectedDate_idx" ON "PurchaseOrder"("organizationId", "expectedDate");
