import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { PurchaseOrderInput, ReceiveGoodsInput, ReturnGoodsInput } from '@/lib/validators/purchase.schema';
import { Session } from 'next-auth';
import { PurchaseOrderStatus } from '@prisma/client';
import { StockService } from '@/services/stock.service';
import { StockMovementType } from '@prisma/client';

export class PurchaseService {
  static async getPurchaseOrders(session: Session | null, status?: PurchaseOrderStatus) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }
    const where = status ? { status } : {};
    return prisma.purchaseOrder.findMany({
      where,
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
        status: PurchaseOrderStatus.PENDING_APPROVAL,
        rejectionReason: null,
      }
    });
  }

  static async approvePurchaseOrder(session: Session | null, id: string) {
    if (!can(session, 'approve', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase order not found');
    
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new Error('Only PENDING_APPROVAL purchase orders can be approved');
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.APPROVED,
        rejectionReason: null,
      }
    });
  }

  static async rejectPurchaseOrder(session: Session | null, id: string, reason: string) {
    if (!can(session, 'approve', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    if (!reason || reason.trim() === '') {
      throw new Error('Rejection reason is required');
    }

    const po = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!po) throw new Error('Purchase order not found');
    
    if (po.status !== PurchaseOrderStatus.PENDING_APPROVAL) {
      throw new Error('Only PENDING_APPROVAL purchase orders can be rejected');
    }

    return prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: PurchaseOrderStatus.DRAFT,
        rejectionReason: reason,
      }
    });
  }

  static async receiveGoods(session: Session | null, id: string, data: ReceiveGoodsInput) {
    if (!can(session, 'update', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    if (!session?.user?.id) {
      throw new Error('User context required');
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: { include: { product: true } } }
    });

    if (!po) throw new Error('Purchase order not found');
    if (po.status !== PurchaseOrderStatus.APPROVED && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new Error('Can only receive goods for APPROVED or PARTIALLY_RECEIVED purchase orders');
    }

    // Process lines
    for (const line of data.lines) {
      if (line.newReceivedQty <= 0) continue;

      const poItem = po.items.find(i => i.id === line.id);
      if (!poItem) continue;

      if (poItem.product.trackBatches) {
        if (!line.batchNumber || line.batchNumber.trim() === '') {
          throw new Error(`Batch number required for product ${poItem.product.name}`);
        }
        await prisma.batch.create({
          data: {
            productId: poItem.productId,
            batchNumber: line.batchNumber,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            quantity: line.newReceivedQty,
            warehouseId: po.warehouseId,
          }
        });
      }

      await StockService.recordMovement({
        type: StockMovementType.PURCHASE_RECEIPT,
        productId: poItem.productId,
        quantity: line.newReceivedQty,
        toWarehouseId: po.warehouseId,
        referenceType: 'PurchaseOrder',
        referenceId: po.id,
        userId: session.user.id,
      });

      await prisma.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          receivedQty: { increment: line.newReceivedQty }
        }
      });
    }

    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (updatedPo) {
      const allFullyReceived = updatedPo.items.every(i => i.receivedQty >= i.orderedQty);
      const newStatus = allFullyReceived ? PurchaseOrderStatus.RECEIVED : PurchaseOrderStatus.PARTIALLY_RECEIVED;
      
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: newStatus }
      });
    }

    return true;
  }

  static async returnGoods(session: Session | null, id: string, data: ReturnGoodsInput) {
    if (!can(session, 'update', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    if (!session?.user?.id) {
      throw new Error('User context required');
    }

    const po = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!po) throw new Error('Purchase order not found');
    if (po.status !== PurchaseOrderStatus.RECEIVED && po.status !== PurchaseOrderStatus.PARTIALLY_RECEIVED) {
      throw new Error('Can only return goods for RECEIVED or PARTIALLY_RECEIVED purchase orders');
    }

    for (const line of data.lines) {
      if (line.returnQty <= 0) continue;

      const poItem = po.items.find(i => i.id === line.id);
      if (!poItem) continue;

      if (line.returnQty > poItem.receivedQty) {
        throw new Error(`Cannot return more than received quantity for product ${poItem.productId}`);
      }

      await StockService.recordMovement({
        type: StockMovementType.RETURN_OUT,
        productId: poItem.productId,
        quantity: -line.returnQty,
        fromWarehouseId: po.warehouseId,
        referenceType: 'PurchaseOrder',
        referenceId: po.id,
        userId: session.user.id,
      });

      await prisma.purchaseOrderItem.update({
        where: { id: poItem.id },
        data: {
          receivedQty: { decrement: line.returnQty }
        }
      });
    }

    const updatedPo = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: { items: true }
    });

    if (updatedPo) {
      const hasAnyReceived = updatedPo.items.some(i => i.receivedQty > 0);
      const allFullyReceived = updatedPo.items.every(i => i.receivedQty >= i.orderedQty);
      
      let newStatus: PurchaseOrderStatus = PurchaseOrderStatus.PARTIALLY_RECEIVED;
      if (allFullyReceived) newStatus = PurchaseOrderStatus.RECEIVED;
      else if (!hasAnyReceived) newStatus = PurchaseOrderStatus.APPROVED; // everything returned!
      
      await prisma.purchaseOrder.update({
        where: { id },
        data: { status: newStatus }
      });
    }

    return true;
  }

  static async getSuggestedPurchases(session: Session | null) {
    if (!can(session, 'read', 'purchasing')) {
      throw new Error('Unauthorized');
    }

    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        stockLevels: true,
        purchaseOrderItems: {
          include: {
            purchaseOrder: {
              include: { supplier: true }
            }
          },
          orderBy: {
            purchaseOrder: { createdAt: 'desc' }
          },
          take: 1
        }
      }
    });

    const suggestions = [];

    for (const product of products) {
      const totalStock = product.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
      
      // Usually reorder point of 0 means don't track, but let's allow anything if totalStock <= reorderPoint
      // Actually, if reorderPoint is 0 and totalStock is 0, we'll suggest it if we only strictly follow <=.
      // Let's explicitly check if reorderPoint > 0 or if the user actively wants to manage it.
      if (product.reorderPoint > 0 && totalStock <= product.reorderPoint) {
        let suggestedSupplier = null;
        if (product.purchaseOrderItems.length > 0) {
          suggestedSupplier = product.purchaseOrderItems[0].purchaseOrder.supplier;
        }

        suggestions.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: totalStock,
          reorderPoint: product.reorderPoint,
          reorderQty: product.reorderQty > 0 ? product.reorderQty : (product.reorderPoint - totalStock + 5), // default some qty
          unitCost: product.costPrice,
          suggestedSupplier: suggestedSupplier ? {
            id: suggestedSupplier.id,
            name: suggestedSupplier.name
          } : null
        });
      }
    }

    return suggestions;
  }
}
