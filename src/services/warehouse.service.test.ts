import { expect, test, describe, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { WarehouseService } from './warehouse.service';

const adminSession = { user: { id: 'user1', email: 'admin@test.com', role: 'ADMIN' }, expires: '9999' } as any;
const viewerSession = { user: { id: 'user2', email: 'viewer@test.com', role: 'VIEWER' }, expires: '9999' } as any;

describe('WarehouseService', () => {
  beforeEach(async () => {
    // Delete any dependent records if necessary
    await prisma.stockMovement.deleteMany();
    await prisma.stockLevel.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.salesOrderItem.deleteMany();
    await prisma.salesOrder.deleteMany();
    await prisma.warehouse.deleteMany();
  });

  test('createWarehouse - success for ADMIN', async () => {
    const warehouse = await WarehouseService.createWarehouse(adminSession, { name: 'Main Warehouse', code: 'MAIN', address: '123 Main St' });
    expect(warehouse.id).toBeDefined();
    expect(warehouse.name).toBe('Main Warehouse');
    expect(warehouse.code).toBe('MAIN');
    expect(warehouse.isActive).toBe(true);
  });

  test('createWarehouse - duplicate code fails', async () => {
    await WarehouseService.createWarehouse(adminSession, { name: 'Main Warehouse', code: 'MAIN' });
    await expect(
      WarehouseService.createWarehouse(adminSession, { name: 'Other Warehouse', code: 'MAIN' })
    ).rejects.toThrow('Warehouse with this code already exists');
  });

  test('createWarehouse - rejection for VIEWER', async () => {
    await expect(
      WarehouseService.createWarehouse(viewerSession, { name: 'Main Warehouse', code: 'MAIN' })
    ).rejects.toThrow('Unauthorized');
  });

  test('updateWarehouse - success for ADMIN', async () => {
    const warehouse = await WarehouseService.createWarehouse(adminSession, { name: 'Main', code: 'MAIN' });
    const updated = await WarehouseService.updateWarehouse(adminSession, warehouse.id, { name: 'Main Updated', code: 'MAIN', isActive: false });
    expect(updated.name).toBe('Main Updated');
    expect(updated.isActive).toBe(false);
  });

  test('deleteWarehouse - success for ADMIN', async () => {
    const warehouse = await WarehouseService.createWarehouse(adminSession, { name: 'Main', code: 'MAIN' });
    await WarehouseService.deleteWarehouse(adminSession, warehouse.id);
    const found = await prisma.warehouse.findUnique({ where: { id: warehouse.id } });
    expect(found).toBeNull();
  });
});
