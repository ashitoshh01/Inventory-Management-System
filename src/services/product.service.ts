import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { ProductInput } from '@/lib/validators/product.schema';
import { Session } from 'next-auth';
import { Prisma } from '@prisma/client';

export class ProductService {
  static async getProducts(session: Session | null, params?: { 
    search?: string, 
    categoryId?: string, 
    isActive?: boolean,
    skip?: number,
    take?: number
  }) {
    if (!can(session, 'read', 'products')) {
      throw new Error('Unauthorized');
    }

    const where: Prisma.ProductWhereInput = {};
    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: 'insensitive' } },
        { sku: { contains: params.search, mode: 'insensitive' } },
        { barcode: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params?.categoryId) {
      where.categoryId = params.categoryId;
    }
    if (params?.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { category: true, images: { where: { isPrimary: true }, take: 1 } },
        orderBy: { name: 'asc' },
        skip: params?.skip || 0,
        take: params?.take || 50,
      }),
      prisma.product.count({ where }),
    ]);

    return { data, total };
  }

  static async getProduct(session: Session | null, id: string) {
    if (!can(session, 'read', 'products')) {
      throw new Error('Unauthorized');
    }
    return prisma.product.findUnique({
      where: { id },
      include: { 
        category: true, 
        images: { orderBy: { isPrimary: 'desc' } }, 
        variants: true,
        bundleItems: { include: { component: true } },
        batches: { orderBy: { expiryDate: 'asc' } }
      },
    });
  }

  static async checkBundleCycle(targetBundleId: string, componentIds: string[], visited: Set<string> = new Set()): Promise<boolean> {
    if (componentIds.includes(targetBundleId)) return true;
    
    for (const id of componentIds) {
      if (visited.has(id)) continue;
      visited.add(id);
      
      const comp = await prisma.product.findUnique({
        where: { id },
        include: { bundleItems: true }
      });
      
      if (comp?.isBundle && comp.bundleItems.length > 0) {
        const nextComponentIds = comp.bundleItems.map(item => item.componentId);
        const hasCycle = await this.checkBundleCycle(targetBundleId, nextComponentIds, visited);
        if (hasCycle) return true;
      }
    }
    return false;
  }

  static async createProduct(session: Session | null, data: ProductInput) {
    if (!can(session, 'create', 'products')) {
      throw new Error('Unauthorized');
    }
    return prisma.product.create({
      data: {
        sku: data.sku,
        barcode: data.barcode || null,
        name: data.name,
        description: data.description || null,
        categoryId: data.categoryId || null,
        unit: data.unit,
        costPrice: data.costPrice,
        salePrice: data.salePrice,
        reorderPoint: data.reorderPoint,
        reorderQty: data.reorderQty,
        trackBatches: data.trackBatches,
        isActive: data.isActive,
        isBundle: data.isBundle,
        images: {
          create: data.images?.map(img => ({ url: img.url, isPrimary: img.isPrimary })) || [],
        },
        variants: {
          create: data.variants?.map(variant => ({ sku: variant.sku, attributes: variant.attributes })) || [],
        },
        bundleItems: data.isBundle && data.bundleItems ? {
          create: data.bundleItems.map(item => ({
            componentId: item.componentId,
            quantity: item.quantity,
          })),
        } : undefined,
      },
    });
  }

  static async updateProduct(session: Session | null, id: string, data: ProductInput) {
    if (!can(session, 'update', 'products')) {
      throw new Error('Unauthorized');
    }

    if (data.isBundle && data.bundleItems?.length) {
      const componentIds = data.bundleItems.map(item => item.componentId);
      const hasCycle = await this.checkBundleCycle(id, componentIds);
      if (hasCycle) {
        throw new Error('Bundle cannot contain itself directly or transitively');
      }
    }
    
    return prisma.$transaction(async (tx) => {
      // Delete existing images that are not in the new list (or just delete all and recreate)
      // To be safe and simple, delete all and recreate
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productVariant.deleteMany({ where: { productId: id } });
      await tx.productBundleItem.deleteMany({ where: { bundleId: id } });
      
      return tx.product.update({
        where: { id },
        data: {
          sku: data.sku,
          barcode: data.barcode || null,
          name: data.name,
          description: data.description || null,
          categoryId: data.categoryId || null,
          unit: data.unit,
          costPrice: data.costPrice,
          salePrice: data.salePrice,
          reorderPoint: data.reorderPoint,
          reorderQty: data.reorderQty,
          trackBatches: data.trackBatches,
          isActive: data.isActive,
          isBundle: data.isBundle,
          images: {
            create: data.images?.map(img => ({ url: img.url, isPrimary: img.isPrimary })) || [],
          },
          variants: {
            create: data.variants?.map(variant => ({ sku: variant.sku, attributes: variant.attributes })) || [],
          },
          bundleItems: data.isBundle && data.bundleItems ? {
            create: data.bundleItems.map(item => ({
              componentId: item.componentId,
              quantity: item.quantity,
            })),
          } : undefined,
        },
      });
    });
  }

  static async deleteProduct(session: Session | null, id: string) {
    if (!can(session, 'delete', 'products')) {
      throw new Error('Unauthorized');
    }
    
    // Check if product is in any stock movements
    const movements = await prisma.stockMovement.findFirst({
      where: { productId: id },
    });
    
    if (movements) {
      throw new Error('Cannot delete product with stock movements. Deactivate it instead.');
    }

    return prisma.product.delete({
      where: { id },
    });
  }
}
