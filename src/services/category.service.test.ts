import { expect, test, describe, beforeEach } from 'vitest';
import prisma from '@/lib/db';
import { CategoryService } from './category.service';

const adminSession = { user: { id: 'user1', email: 'admin@test.com', role: 'ADMIN' }, expires: '9999' } as any;
const viewerSession = { user: { id: 'user2', email: 'viewer@test.com', role: 'VIEWER' }, expires: '9999' } as any;

describe('CategoryService', () => {
  beforeEach(async () => {
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
  });

  test('createCategory - success for ADMIN', async () => {
    const category = await CategoryService.createCategory(adminSession, { name: 'Electronics' });
    expect(category.id).toBeDefined();
    expect(category.name).toBe('Electronics');
  });

  test('createCategory - rejection for VIEWER', async () => {
    await expect(
      CategoryService.createCategory(viewerSession, { name: 'Electronics' })
    ).rejects.toThrow('Unauthorized');
  });

  test('updateCategory - success for ADMIN', async () => {
    const category = await CategoryService.createCategory(adminSession, { name: 'Elec' });
    const updated = await CategoryService.updateCategory(adminSession, category.id, { name: 'Electronics' });
    expect(updated.name).toBe('Electronics');
  });

  test('deleteCategory - success for ADMIN', async () => {
    const category = await CategoryService.createCategory(adminSession, { name: 'Elec' });
    await CategoryService.deleteCategory(adminSession, category.id);
    const found = await prisma.category.findUnique({ where: { id: category.id } });
    expect(found).toBeNull();
  });
});
