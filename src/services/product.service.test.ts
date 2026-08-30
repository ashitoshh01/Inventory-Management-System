import { expect, test, describe, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { ProductService } from './product.service';

const adminSession = { user: { id: 'user1', email: 'admin@test.com', role: 'ADMIN' }, expires: '9999' } as any;
const viewerSession = { user: { id: 'user2', email: 'viewer@test.com', role: 'VIEWER' }, expires: '9999' } as any;

const baseProductData = {
  sku: 'TEST-001',
  name: 'Test Product',
  unit: 'pcs',
  costPrice: 10,
  salePrice: 20,
  reorderPoint: 5,
  reorderQty: 10,
  trackBatches: false,
  isActive: true,
  isBundle: false,
};

describe('ProductService', () => {
  beforeEach(async () => {
    await prisma.productBundleItem.deleteMany();
    await prisma.product.deleteMany();
  });

  test('createProduct - success for ADMIN', async () => {
    const product = await ProductService.createProduct(adminSession, baseProductData);
    expect(product.id).toBeDefined();
    expect(product.sku).toBe('TEST-001');
  });

  test('createProduct - rejection for VIEWER', async () => {
    await expect(
      ProductService.createProduct(viewerSession, baseProductData)
    ).rejects.toThrow('Unauthorized');
  });

  test('createProduct - SKU uniqueness violation', async () => {
    await ProductService.createProduct(adminSession, baseProductData);
    await expect(
      ProductService.createProduct(adminSession, baseProductData)
    ).rejects.toThrow(/Unique constraint failed on the fields: \(`sku`\)/); // Prisma uniqueness error
  });

  test('updateProduct - success for ADMIN', async () => {
    const product = await ProductService.createProduct(adminSession, baseProductData);
    const updated = await ProductService.updateProduct(adminSession, product.id, { ...baseProductData, name: 'Updated Product' });
    expect(updated.name).toBe('Updated Product');
  });

  test('deleteProduct - success for ADMIN', async () => {
    const product = await ProductService.createProduct(adminSession, baseProductData);
    await ProductService.deleteProduct(adminSession, product.id);
    const found = await prisma.product.findUnique({ where: { id: product.id } });
    expect(found).toBeNull();
  });

  test('Bundle self-reference is rejected', async () => {
    const product = await ProductService.createProduct(adminSession, { ...baseProductData, isBundle: true });
    
    await expect(
      ProductService.updateProduct(adminSession, product.id, {
        ...baseProductData,
        isBundle: true,
        bundleItems: [{ componentId: product.id, quantity: 1 }]
      })
    ).rejects.toThrow('Bundle cannot contain itself directly or transitively');
  });

  test('Bundle transitive cycle is rejected', async () => {
    const p1 = await ProductService.createProduct(adminSession, { ...baseProductData, sku: 'P1', isBundle: true });
    const p2 = await ProductService.createProduct(adminSession, { ...baseProductData, sku: 'P2', isBundle: true });
    
    // P1 -> P2
    await ProductService.updateProduct(adminSession, p1.id, {
      ...baseProductData, sku: 'P1', isBundle: true,
      bundleItems: [{ componentId: p2.id, quantity: 1 }]
    });

    // P2 -> P1 (Cycle)
    await expect(
      ProductService.updateProduct(adminSession, p2.id, {
        ...baseProductData, sku: 'P2', isBundle: true,
        bundleItems: [{ componentId: p1.id, quantity: 1 }]
      })
    ).rejects.toThrow('Bundle cannot contain itself directly or transitively');
  });
});
