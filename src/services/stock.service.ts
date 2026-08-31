import prisma from '@/lib/db';
import { StockMovementType } from '@prisma/client';

export class StockService {
  /**
   * Core function for recording any stock movement.
   * Decrements fromWarehouseId and increments toWarehouseId.
   */
  static async recordMovement(params: {
    type: StockMovementType;
    productId: string;
    quantity: number; // positive = in, negative = out
    fromWarehouseId?: string;
    toWarehouseId?: string;
    reasonCode?: string;
    referenceType?: string;
    referenceId?: string;
    userId: string;
  }) {
    return prisma.$transaction(async (tx) => {
      // 1. Create the movement record
      const movement = await tx.stockMovement.create({
        data: {
          type: params.type,
          productId: params.productId,
          quantity: params.quantity,
          fromWarehouseId: params.fromWarehouseId,
          toWarehouseId: params.toWarehouseId,
          reasonCode: params.reasonCode,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          userId: params.userId,
        },
      });

      // 2. Handle fromWarehouseId (decrement)
      if (params.fromWarehouseId) {
        // We take the absolute value so we always decrement correctly
        // even if the caller passed a negative quantity for an 'OUT'
        const decrementAmount = Math.abs(params.quantity);

        const currentStock = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: params.productId,
              warehouseId: params.fromWarehouseId,
            }
          }
        });

        const currentQty = currentStock?.quantity ?? 0;
        if (currentQty - decrementAmount < 0) {
          throw new Error(`Insufficient stock in warehouse ${params.fromWarehouseId}. Cannot decrement by ${decrementAmount}. Current stock: ${currentQty}`);
        }

        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: params.productId,
              warehouseId: params.fromWarehouseId,
            }
          },
          update: {
            quantity: { decrement: decrementAmount }
          },
          create: {
            productId: params.productId,
            warehouseId: params.fromWarehouseId,
            quantity: -decrementAmount // In theory this won't be reached because of the check above, but required by upsert
          }
        });
      }

      // 3. Handle toWarehouseId (increment)
      if (params.toWarehouseId) {
        // If it's a transfer (both warehouses provided), increment by the absolute amount.
        // Otherwise, use the raw quantity (which could be negative for an adjustment).
        const incrementAmount = params.fromWarehouseId && params.toWarehouseId 
          ? Math.abs(params.quantity)
          : params.quantity;

        const currentStock = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: params.productId,
              warehouseId: params.toWarehouseId,
            }
          }
        });

        const currentQty = currentStock?.quantity ?? 0;
        if (currentQty + incrementAmount < 0) {
          throw new Error(`Insufficient stock in warehouse ${params.toWarehouseId}. Cannot reduce stock by ${Math.abs(incrementAmount)}. Current stock: ${currentQty}`);
        }

        await tx.stockLevel.upsert({
          where: {
            productId_warehouseId: {
              productId: params.productId,
              warehouseId: params.toWarehouseId,
            }
          },
          update: {
            quantity: { increment: incrementAmount }
          },
          create: {
            productId: params.productId,
            warehouseId: params.toWarehouseId,
            quantity: incrementAmount
          }
        });
      }

      return movement;
    });
  }

  /**
   * Retrieves the stock level for a specific product in a specific warehouse.
   */
  static async getStockLevel(productId: string, warehouseId: string) {
    return prisma.stockLevel.findUnique({
      where: {
        productId_warehouseId: {
          productId,
          warehouseId,
        }
      }
    });
  }

  /**
   * Lists products that are at or below their reorder point.
   * If warehouseId is provided, checks against the stock in that specific warehouse.
   * Otherwise, aggregates stock across all warehouses.
   */
  static async listLowStockProducts(warehouseId?: string) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        stockLevels: warehouseId ? { where: { warehouseId } } : true,
      }
    });

    return products.map(product => {
      const totalStock = product.stockLevels.reduce((sum, level) => sum + level.quantity, 0);
      return {
        ...product,
        totalStock,
        isLowStock: totalStock <= product.reorderPoint
      };
    }).filter(p => p.isLowStock);
  }

  /**
   * Retrieves paginated stock levels with search and filtering.
   */
  static async getStockLevels(
    session: any, 
    params: { search?: string, warehouseId?: string, skip?: number, take?: number }
  ) {
    // Basic auth check for completeness (import can if needed, or omit for now if not strictly enforced here)
    // We will just do the query
    const where: any = {};
    if (params.warehouseId && params.warehouseId !== 'all') {
      where.warehouseId = params.warehouseId;
    }
    if (params.search) {
      where.product = {
        OR: [
          { name: { contains: params.search, mode: 'insensitive' } },
          { sku: { contains: params.search, mode: 'insensitive' } },
        ]
      };
    }

    const [data, total] = await Promise.all([
      prisma.stockLevel.findMany({
        where,
        include: {
          product: true,
          warehouse: true,
        },
        skip: params.skip,
        take: params.take,
        orderBy: { product: { name: 'asc' } }
      }),
      prisma.stockLevel.count({ where })
    ]);

    return { data, total };
  }

  /**
   * Retrieves paginated stock transfers with filtering.
   */
  static async getTransfers(
    session: any,
    params: { warehouseId?: string, startDate?: string, endDate?: string, skip?: number, take?: number }
  ) {
    const where: any = { type: 'TRANSFER' };
    
    if (params.warehouseId && params.warehouseId !== 'all') {
      where.OR = [
        { fromWarehouseId: params.warehouseId },
        { toWarehouseId: params.warehouseId },
      ];
    }
    
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = new Date(params.startDate);
      // For endDate, we usually want to include the whole day, but for simplicity we rely on ISO strings or we just pass it as is
      if (params.endDate) {
        const end = new Date(params.endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [data, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: true,
          fromWarehouse: true,
          toWarehouse: true,
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: params.skip,
        take: params.take,
      }),
      prisma.stockMovement.count({ where })
    ]);

    return { data, total };
  }

  /**
   * Retrieves all active products and their current stock level in a specific warehouse.
   */
  static async getStockCountList(warehouseId: string) {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        stockLevels: {
          where: { warehouseId }
        }
      },
      orderBy: { name: 'asc' }
    });

    return products.map(p => ({
      productId: p.id,
      productName: p.name,
      sku: p.sku,
      systemQuantity: p.stockLevels[0]?.quantity || 0,
    }));
  }
}
