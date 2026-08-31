import { expect, test, describe, beforeEach, afterEach } from 'vitest';
import prisma from '@/lib/db';
import { StockService } from './stock.service';
import { StockMovementType } from '@prisma/client';

describe('StockService', () => {
  let product: any;
  let warehouse1: any;
  let warehouse2: any;
  const adminSession = { user: { id: 'admin-1' } };

  beforeEach(async () => {
    // Clear out data
    await prisma.stockMovement.deleteMany({});
    await prisma.stockLevel.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.warehouse.deleteMany({});
    await prisma.user.deleteMany({});

    await prisma.user.create({
      data: { id: 'admin-1', email: 'admin-1@test.com', name: 'Admin', role: 'ADMIN', passwordHash: 'hash' }
    });

    product = await prisma.product.create({
      data: { name: 'Test Product', sku: 'SKU-TEST', costPrice: 10, salePrice: 20, reorderPoint: 5 }
    });

    warehouse1 = await prisma.warehouse.create({
      data: { name: 'Warehouse 1', code: 'WH1' }
    });
    
    warehouse2 = await prisma.warehouse.create({
      data: { name: 'Warehouse 2', code: 'WH2' }
    });
  });

  test('recordMovement correctly increments StockLevel', async () => {
    const m = await StockService.recordMovement({
      type: StockMovementType.RECEIPT,
      productId: product.id,
      quantity: 50,
      toWarehouseId: warehouse1.id,
      userId: 'admin-1'
    });

    expect(m.quantity).toBe(50);
    const sl = await StockService.getStockLevel(product.id, warehouse1.id);
    expect(sl?.quantity).toBe(50);
  });

  test('TRANSFER correctly moves quantity between two warehouses in one transaction', async () => {
    // Initial stock
    await StockService.recordMovement({
      type: StockMovementType.RECEIPT,
      productId: product.id,
      quantity: 100,
      toWarehouseId: warehouse1.id,
      userId: 'admin-1'
    });

    await StockService.recordMovement({
      type: StockMovementType.TRANSFER,
      productId: product.id,
      quantity: 30,
      fromWarehouseId: warehouse1.id,
      toWarehouseId: warehouse2.id,
      userId: 'admin-1'
    });

    const sl1 = await StockService.getStockLevel(product.id, warehouse1.id);
    const sl2 = await StockService.getStockLevel(product.id, warehouse2.id);

    expect(sl1?.quantity).toBe(70);
    expect(sl2?.quantity).toBe(30);
    
    const count = await prisma.stockMovement.count();
    expect(count).toBe(2);
  });

  test('attempting to decrement below zero throws and does NOT create a StockMovement row', async () => {
    await StockService.recordMovement({
      type: StockMovementType.RECEIPT,
      productId: product.id,
      quantity: 10,
      toWarehouseId: warehouse1.id,
      userId: 'admin-1'
    });

    await expect(StockService.recordMovement({
      type: StockMovementType.SALE,
      productId: product.id,
      quantity: -15, // Outward movement
      fromWarehouseId: warehouse1.id,
      userId: 'admin-1'
    })).rejects.toThrow(/Insufficient stock/);

    const sl1 = await StockService.getStockLevel(product.id, warehouse1.id);
    expect(sl1?.quantity).toBe(10); // Unchanged

    const count = await prisma.stockMovement.count();
    expect(count).toBe(1); // Only the initial receipt
  });

  test('concurrent recordMovement calls on same product/warehouse dont cause lost updates', async () => {
    // Start with 0. Add 10 concurrently 50 times.
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(StockService.recordMovement({
        type: StockMovementType.RECEIPT,
        productId: product.id,
        quantity: 10,
        toWarehouseId: warehouse1.id,
        userId: 'admin-1'
      }));
    }
    
    await Promise.all(promises);
    
    const sl1 = await StockService.getStockLevel(product.id, warehouse1.id);
    expect(sl1?.quantity).toBe(500); // 50 * 10 = 500
  });

  test('listLowStockProducts only returns products below threshold', async () => {
    const productHigh = await prisma.product.create({
      data: { name: 'High Stock', sku: 'SKU-HIGH', costPrice: 10, salePrice: 20, reorderPoint: 5 }
    });

    // product has reorderPoint 5, productHigh has reorderPoint 5

    // Put 3 in product (low stock)
    await StockService.recordMovement({
      type: StockMovementType.RECEIPT,
      productId: product.id,
      quantity: 3,
      toWarehouseId: warehouse1.id,
      userId: 'admin-1'
    });

    // Put 10 in productHigh (sufficient stock)
    await StockService.recordMovement({
      type: StockMovementType.RECEIPT,
      productId: productHigh.id,
      quantity: 10,
      toWarehouseId: warehouse1.id,
      userId: 'admin-1'
    });

    const lowStock = await StockService.listLowStockProducts();
    expect(lowStock.length).toBe(1);
    expect(lowStock[0].id).toBe(product.id);
  });
});
