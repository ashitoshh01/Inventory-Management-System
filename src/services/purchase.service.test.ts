import { expect, test, describe, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { PurchaseService } from './purchase.service';
import { PurchaseOrderStatus } from '@prisma/client';
import { StockService } from './stock.service';

describe('PurchaseService', () => {
  let supplier: any;
  let warehouse: any;
  let productRegular: any;
  let productBatch: any;
  
  const adminSession = { user: { id: 'admin-1', role: 'ADMIN' } };
  const managerSession = { user: { id: 'manager-1', role: 'MANAGER' } };
  const staffSession = { user: { id: 'staff-1', role: 'WAREHOUSE_STAFF' } };

  beforeEach(async () => {
    // Clear out data
    await prisma.batch.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.stockLevel.deleteMany({});
    await prisma.purchaseOrderItem.deleteMany({});
    await prisma.purchaseOrder.deleteMany({});
    await prisma.supplier.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.warehouse.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.create({
      data: { id: 'admin-1', email: 'admin-1@test.com', name: 'Admin', role: 'ADMIN', passwordHash: 'hash' }
    });
    
    await prisma.user.create({
      data: { id: 'manager-1', email: 'manager-1@test.com', name: 'Manager', role: 'MANAGER', passwordHash: 'hash' }
    });
    
    await prisma.user.create({
      data: { id: 'staff-1', email: 'staff-1@test.com', name: 'Staff', role: 'WAREHOUSE_STAFF', passwordHash: 'hash' }
    });

    supplier = await prisma.supplier.create({
      data: { name: 'Test Supplier', email: 'test@supplier.com' }
    });

    warehouse = await prisma.warehouse.create({
      data: { name: 'Main WH', code: 'WH1' }
    });

    productRegular = await prisma.product.create({
      data: { name: 'Regular Prod', sku: 'REG-1', costPrice: 10, salePrice: 20, unit: 'pcs' }
    });
    
    productBatch = await prisma.product.create({
      data: { name: 'Batch Prod', sku: 'BAT-1', costPrice: 15, salePrice: 25, trackBatches: true, unit: 'pcs' }
    });
  });

  test('PO status transitions only happen in valid order & permission checks', async () => {
    // Create PO
    const po = await PurchaseService.createPurchaseOrder(managerSession as any, {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      items: [
        { productId: productRegular.id, orderedQty: 10, unitCost: 10 }
      ]
    });
    
    expect(po.status).toBe(PurchaseOrderStatus.DRAFT);
    
    // Cannot receive a DRAFT PO
    await expect(PurchaseService.receiveGoods(managerSession as any, po.id, { lines: [{ id: po.items[0].id, productId: productRegular.id, newReceivedQty: 5 }] }))
      .rejects.toThrow(/Can only receive goods for APPROVED or PARTIALLY_RECEIVED/);
      
    // Submit for approval
    const submitted = await PurchaseService.submitForApproval(managerSession as any, po.id);
    expect(submitted.status).toBe(PurchaseOrderStatus.PENDING_APPROVAL);
    
    // Staff cannot approve
    await expect(PurchaseService.approvePurchaseOrder(staffSession as any, po.id))
      .rejects.toThrow(/Unauthorized/);
      
    // Admin approves
    const approved = await PurchaseService.approvePurchaseOrder(adminSession as any, po.id);
    expect(approved.status).toBe(PurchaseOrderStatus.APPROVED);
    
    // Cannot approve an already APPROVED PO
    await expect(PurchaseService.approvePurchaseOrder(adminSession as any, po.id))
      .rejects.toThrow(/Only PENDING_APPROVAL purchase orders can be approved/);
  });

  test('receiving partial quantities correctly updates receivedQty and leaves status as PARTIALLY_RECEIVED, then full to RECEIVED', async () => {
    let po = await PurchaseService.createPurchaseOrder(managerSession as any, {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      items: [
        { productId: productRegular.id, orderedQty: 10, unitCost: 10 }
      ]
    });
    await PurchaseService.submitForApproval(managerSession as any, po.id);
    await PurchaseService.approvePurchaseOrder(adminSession as any, po.id);
    
    // Receive 4
    await PurchaseService.receiveGoods(managerSession as any, po.id, { 
      lines: [{ id: po.items[0].id, productId: productRegular.id, newReceivedQty: 4 }] 
    });
    
    let updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
    expect(updatedPo?.status).toBe(PurchaseOrderStatus.PARTIALLY_RECEIVED);
    expect(updatedPo?.items[0].receivedQty).toBe(4);
    
    // Receive remaining 6
    await PurchaseService.receiveGoods(managerSession as any, po.id, { 
      lines: [{ id: po.items[0].id, productId: productRegular.id, newReceivedQty: 6 }] 
    });
    
    updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
    expect(updatedPo?.status).toBe(PurchaseOrderStatus.RECEIVED);
    expect(updatedPo?.items[0].receivedQty).toBe(10);
  });
  
  test('receiving a PO line for a batch-tracked product creates both a StockMovement AND a Batch row, and StockLevel increases', async () => {
    let po = await PurchaseService.createPurchaseOrder(managerSession as any, {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      items: [
        { productId: productBatch.id, orderedQty: 20, unitCost: 15 }
      ]
    });
    await PurchaseService.submitForApproval(managerSession as any, po.id);
    await PurchaseService.approvePurchaseOrder(adminSession as any, po.id);
    
    // Receive with batch
    await PurchaseService.receiveGoods(managerSession as any, po.id, { 
      lines: [{ id: po.items[0].id, productId: productBatch.id, newReceivedQty: 20, batchNumber: 'BATCH-X' }] 
    });
    
    const batches = await prisma.batch.findMany({ where: { productId: productBatch.id } });
    expect(batches.length).toBe(1);
    expect(batches[0].batchNumber).toBe('BATCH-X');
    expect(batches[0].quantity).toBe(20);
    
    const sl = await StockService.getStockLevel(productBatch.id, warehouse.id);
    expect(sl?.quantity).toBe(20);
    
    const movements = await prisma.stockMovement.findMany({ where: { productId: productBatch.id } });
    expect(movements.length).toBe(1);
    expect(movements[0].type).toBe('PURCHASE_RECEIPT');
  });

  test('purchase return correctly decrements stock and cannot return more than was received', async () => {
    let po = await PurchaseService.createPurchaseOrder(managerSession as any, {
      supplierId: supplier.id,
      warehouseId: warehouse.id,
      items: [
        { productId: productRegular.id, orderedQty: 10, unitCost: 10 }
      ]
    });
    await PurchaseService.submitForApproval(managerSession as any, po.id);
    await PurchaseService.approvePurchaseOrder(adminSession as any, po.id);
    
    // Receive 8
    await PurchaseService.receiveGoods(managerSession as any, po.id, { 
      lines: [{ id: po.items[0].id, productId: productRegular.id, newReceivedQty: 8 }] 
    });
    
    // Return 3
    await PurchaseService.returnGoods(managerSession as any, po.id, {
      lines: [{ id: po.items[0].id, productId: productRegular.id, returnQty: 3 }]
    });
    
    let updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id }, include: { items: true } });
    expect(updatedPo?.items[0].receivedQty).toBe(5);
    
    const sl = await StockService.getStockLevel(productRegular.id, warehouse.id);
    expect(sl?.quantity).toBe(5);
    
    // Cannot return 6 (more than received)
    await expect(PurchaseService.returnGoods(managerSession as any, po.id, {
      lines: [{ id: po.items[0].id, productId: productRegular.id, returnQty: 6 }]
    })).rejects.toThrow(/Cannot return more than received quantity/);
  });
});
