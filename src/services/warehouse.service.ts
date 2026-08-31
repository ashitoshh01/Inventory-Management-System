import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { WarehouseInput } from '@/lib/validators/warehouse.schema';
import { Session } from 'next-auth';

export class WarehouseService {
  static async getWarehouses(session: Session | null) {
    if (!can(session, 'read', 'warehouses')) {
      throw new Error('Unauthorized');
    }
    return prisma.warehouse.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async getWarehouse(session: Session | null, id: string) {
    if (!can(session, 'read', 'warehouses', id)) {
      throw new Error('Unauthorized');
    }
    return prisma.warehouse.findUnique({
      where: { id },
    });
  }

  static async createWarehouse(session: Session | null, data: WarehouseInput) {
    if (!can(session, 'create', 'warehouses')) {
      throw new Error('Unauthorized');
    }
    
    // Check if code already exists
    const existing = await prisma.warehouse.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new Error('Warehouse with this code already exists');
    }

    return prisma.warehouse.create({
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async updateWarehouse(session: Session | null, id: string, data: WarehouseInput) {
    if (!can(session, 'update', 'warehouses', id)) {
      throw new Error('Unauthorized');
    }

    // Check if code already exists and belongs to another warehouse
    const existing = await prisma.warehouse.findUnique({
      where: { code: data.code },
    });
    if (existing && existing.id !== id) {
      throw new Error('Warehouse with this code already exists');
    }

    return prisma.warehouse.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        address: data.address,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async deleteWarehouse(session: Session | null, id: string) {
    if (!can(session, 'delete', 'warehouses', id)) {
      throw new Error('Unauthorized');
    }

    // Check for existing associations before delete
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      include: {
        stockLevels: { take: 1 },
        stockMovementsIn: { take: 1 },
        stockMovementsOut: { take: 1 },
        purchaseOrders: { take: 1 },
        salesOrders: { take: 1 },
      }
    });

    if (!warehouse) throw new Error('Warehouse not found');

    if (
      warehouse.stockLevels.length > 0 ||
      warehouse.stockMovementsIn.length > 0 ||
      warehouse.stockMovementsOut.length > 0 ||
      warehouse.purchaseOrders.length > 0 ||
      warehouse.salesOrders.length > 0
    ) {
      throw new Error('Cannot delete warehouse with associated records. Consider deactivating it instead.');
    }

    return prisma.warehouse.delete({
      where: { id },
    });
  }
}
