import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { PurchaseOrderInput } from '@/lib/validators/purchase.schema';
import { Session } from 'next-auth';
import { PurchaseOrderStatus } from '@prisma/client';

export class PurchaseService {
  static async getPurchaseOrders(session: Session | null) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    return prisma.purchaseOrder.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        warehouse: true,
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      }
    });
  }

  static async getPurchaseOrder(session: Session | null, id: string) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    return prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: true,
        createdBy: { select: { name: true } },
        items: {
          include: { product: true }
        }
      }
    });
  }

  static async createPurchaseOrder(session: Session | null, data: PurchaseOrderInput) {
    if (!can(session, 'create', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    
    if (!session?.user?.id) {
      throw new Error('User context required');
    }

    const poNumber = `PO-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

    return prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: data.supplierId,
          warehouseId: data.warehouseId,
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
          createdById: session.user.id!,
          status: PurchaseOrderStatus.DRAFT,
          items: {
            create: data.items.map(item => ({
              productId: item.productId,
              orderedQty: item.orderedQty,
              unitCost: item.unitCost,
            }))
          }
        },
        include: {
          items: true
        }
      });
      return po;
    });
  }

  static async submitForApproval(session: Session | null, id: string) {
    if (!can(session, 'update', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase order not found');
    
    if (po.status !== PurchaseOrderStatus.DRAFT) {
      throw new Error('Only DRAFT purchase orders can be submitted for approval');
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.PENDING_APPROVAL
      }
    });
  }
}
