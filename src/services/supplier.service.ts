import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { SupplierInput } from '@/lib/validators/supplier.schema';
import { Session } from 'next-auth';

export class SupplierService {
  static async getSuppliers(session: Session | null) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    return prisma.supplier.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async getSupplier(session: Session | null, id: string) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    return prisma.supplier.findUnique({
      where: { id },
    });
  }

  static async createSupplier(session: Session | null, data: SupplierInput) {
    if (!can(session, 'create', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    return prisma.supplier.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        leadTimeDays: data.leadTimeDays ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async updateSupplier(session: Session | null, id: string, data: SupplierInput) {
    if (!can(session, 'update', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    return prisma.supplier.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        leadTimeDays: data.leadTimeDays ?? null,
        isActive: data.isActive ?? true,
      },
    });
  }

  static async deleteSupplier(session: Session | null, id: string) {
    if (!can(session, 'delete', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    // Check for existing associations before delete
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: { take: 1 },
      }
    });

    if (!supplier) throw new Error('Supplier not found');

    if (supplier.purchaseOrders.length > 0) {
      throw new Error('Cannot delete supplier with associated purchase orders. Consider deactivating it instead.');
    }

    return prisma.supplier.delete({
      where: { id },
    });
  }
}
