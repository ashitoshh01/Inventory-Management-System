import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma, Category } from '@repo/database';
import { CategoryDto, PaginatedResponse } from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { CreateCategoryDto, UpdateCategoryDto, QueryCategoryDto } from './dto/category.dto';
import {
  CategoryNotFoundException,
  CategoryDuplicateException,
  CategoryDeleteConflictException,
} from './categories.errors';
import { createPaginatedResponse } from '../core/dto/pagination.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    actorUserId: string,
    dto: CreateCategoryDto,
    requestId?: string,
  ): Promise<CategoryDto> {
    const trimmedName = dto.name.trim();

    // Enforce case-insensitive uniqueness within tenant
    const existing = await this.prisma.category.findFirst({
      where: {
        organizationId,
        name: { equals: trimmedName, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new CategoryDuplicateException(
        `Category "${trimmedName}" already exists in this organization`,
      );
    }

    const category = await this.prisma.category.create({
      data: {
        organizationId,
        name: trimmedName,
        description: dto.description ? dto.description.trim() : null,
      },
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'category.created',
      entityType: 'Category',
      entityId: category.id,
      metadata: { name: category.name },
      ...(requestId ? { requestId } : {}),
    });

    return this.formatCategory(category);
  }

  async findAll(
    organizationId: string,
    query: QueryCategoryDto,
    requestId?: string,
  ): Promise<PaginatedResponse<CategoryDto>> {
    const where: Prisma.CategoryWhereInput = { organizationId };

    if (query.search && query.search.trim() !== '') {
      where.name = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const sortBy = query.getSafeSortBy();
    const sortOrder = query.sortOrder || 'desc';

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip: query.getSkip(),
        take: query.getTake(),
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return createPaginatedResponse(
      categories.map((cat) => this.formatCategory(cat)),
      total,
      query.page,
      query.limit,
      requestId,
    );
  }

  async findOne(id: string, organizationId: string): Promise<CategoryDto> {
    const category = await this.prisma.category.findFirst({
      where: { id, organizationId },
    });

    if (!category) {
      throw new CategoryNotFoundException();
    }

    return this.formatCategory(category);
  }

  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateCategoryDto,
    requestId?: string,
  ): Promise<CategoryDto> {
    const existing = await this.prisma.category.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new CategoryNotFoundException();
    }

    const updatedData: Prisma.CategoryUpdateInput = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const duplicate = await this.prisma.category.findFirst({
          where: {
            organizationId,
            name: { equals: trimmedName, mode: 'insensitive' },
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new CategoryDuplicateException(
            `Category "${trimmedName}" already exists in this organization`,
          );
        }
      }
      updatedData.name = trimmedName;
    }

    if (dto.description !== undefined) {
      updatedData.description = dto.description ? dto.description.trim() : null;
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: updatedData,
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'category.updated',
      entityType: 'Category',
      entityId: id,
      metadata: {
        changedFields: Object.keys(dto),
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.formatCategory(updated);
  }

  async delete(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.category.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new CategoryNotFoundException();
    }

    try {
      await this.prisma.category.delete({
        where: { id },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2003'
      ) {
        throw new CategoryDeleteConflictException(
          'Cannot delete category because it is referenced by other resources',
        );
      }
      throw err;
    }

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'category.deleted',
      entityType: 'Category',
      entityId: id,
      metadata: { name: existing.name },
      ...(requestId ? { requestId } : {}),
    });

    return { message: 'Category deleted successfully', id };
  }

  public formatCategory(category: Category): CategoryDto {
    return {
      id: category.id,
      organizationId: category.organizationId,
      name: category.name,
      description: category.description,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString(),
    };
  }
}
