import prisma from '@/lib/db';
import { can } from '@/lib/permissions';
import { CategoryInput } from '@/lib/validators/category.schema';
import { Session } from 'next-auth';

export class CategoryService {
  static async getCategories(session: Session | null) {
    if (!can(session, 'read', 'products')) {
      throw new Error('Unauthorized');
    }
    return prisma.category.findMany({
      include: { parent: true, children: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getCategory(session: Session | null, id: string) {
    if (!can(session, 'read', 'products')) {
      throw new Error('Unauthorized');
    }
    return prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
  }

  static async createCategory(session: Session | null, data: CategoryInput) {
    if (!can(session, 'create', 'products')) {
      throw new Error('Unauthorized');
    }
    return prisma.category.create({
      data: {
        name: data.name,
        parentId: data.parentId,
      },
    });
  }

  static async updateCategory(session: Session | null, id: string, data: CategoryInput) {
    if (!can(session, 'update', 'products')) {
      throw new Error('Unauthorized');
    }
    // Cannot set self as parent
    if (id === data.parentId) {
      throw new Error('Category cannot be its own parent');
    }
    return prisma.category.update({
      where: { id },
      data: {
        name: data.name,
        parentId: data.parentId,
      },
    });
  }

  static async deleteCategory(session: Session | null, id: string) {
    if (!can(session, 'delete', 'products')) {
      throw new Error('Unauthorized');
    }
    
    // Check if it has children
    const category = await prisma.category.findUnique({
      where: { id },
      include: { children: true, products: true },
    });

    if (!category) throw new Error('Category not found');

    if (category.children.length > 0) {
      throw new Error('Cannot delete category with subcategories');
    }

    if (category.products.length > 0) {
      throw new Error('Cannot delete category containing products');
    }

    return prisma.category.delete({
      where: { id },
    });
  }
}
