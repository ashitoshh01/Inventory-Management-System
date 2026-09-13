-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesOrderNumber" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "idempotencyPayloadHash" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT,
    "status" "SalesOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedDate" TIMESTAMP(3),
    "warehouseId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subtotal" DECIMAL(14,4) NOT NULL,
    "taxTotal" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,4) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,
    "lineTotal" DECIMAL(14,4) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");
CREATE INDEX "Customer_organizationId_status_idx" ON "Customer"("organizationId", "status");
CREATE INDEX "Customer_organizationId_name_idx" ON "Customer"("organizationId", "name");
CREATE INDEX "Customer_organizationId_createdAt_idx" ON "Customer"("organizationId", "createdAt");
CREATE UNIQUE INDEX "Customer_organizationId_id_key" ON "Customer"("organizationId", "id");

-- CreateIndex
CREATE INDEX "SalesOrder_organizationId_idx" ON "SalesOrder"("organizationId");
CREATE INDEX "SalesOrder_organizationId_status_idx" ON "SalesOrder"("organizationId", "status");
CREATE INDEX "SalesOrder_organizationId_warehouseId_idx" ON "SalesOrder"("organizationId", "warehouseId");
CREATE INDEX "SalesOrder_organizationId_customerId_idx" ON "SalesOrder"("organizationId", "customerId");
CREATE INDEX "SalesOrder_organizationId_orderDate_idx" ON "SalesOrder"("organizationId", "orderDate");
CREATE INDEX "SalesOrder_organizationId_createdAt_idx" ON "SalesOrder"("organizationId", "createdAt");
CREATE UNIQUE INDEX "SalesOrder_organizationId_id_key" ON "SalesOrder"("organizationId", "id");
CREATE UNIQUE INDEX "SalesOrder_organizationId_salesOrderNumber_key" ON "SalesOrder"("organizationId", "salesOrderNumber");
CREATE UNIQUE INDEX "SalesOrder_organizationId_idempotencyKey_key" ON "SalesOrder"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "SalesOrderLine_organizationId_idx" ON "SalesOrderLine"("organizationId");
CREATE INDEX "SalesOrderLine_organizationId_salesOrderId_idx" ON "SalesOrderLine"("organizationId", "salesOrderId");
CREATE INDEX "SalesOrderLine_organizationId_productId_idx" ON "SalesOrderLine"("organizationId", "productId");
CREATE INDEX "SalesOrderLine_organizationId_createdAt_idx" ON "SalesOrderLine"("organizationId", "createdAt");
CREATE UNIQUE INDEX "SalesOrderLine_organizationId_id_key" ON "SalesOrderLine"("organizationId", "id");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_organizationId_warehouseId_fkey" FOREIGN KEY ("organizationId", "warehouseId") REFERENCES "Warehouse"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_organizationId_customerId_fkey" FOREIGN KEY ("organizationId", "customerId") REFERENCES "Customer"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_organizationId_salesOrderId_fkey" FOREIGN KEY ("organizationId", "salesOrderId") REFERENCES "SalesOrder"("organizationId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_organizationId_productId_fkey" FOREIGN KEY ("organizationId", "productId") REFERENCES "Product"("organizationId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraints
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_subtotal_non_negative" CHECK ("subtotal" >= 0);
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_taxTotal_non_negative" CHECK ("taxTotal" >= 0);
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_grandTotal_non_negative" CHECK ("grandTotal" >= 0);
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_grandTotal_math" CHECK ("grandTotal" = "subtotal" + "taxTotal");

ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_unitPrice_non_negative" CHECK ("unitPrice" >= 0);
ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_lineTotal_non_negative" CHECK ("lineTotal" >= 0);
