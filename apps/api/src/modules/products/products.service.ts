import { Injectable } from '@nestjs/common';
import { PrismaService, Product, Category, Prisma } from '@repo/database';
import { ProductDto, CreateProductInput, ProductStatus, PaginatedResponse } from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { ProductValidator } from './products.validator';
import {
  ProductNotFoundException,
  ProductDuplicateSkuException,
  InvalidCategoryReferenceException,
  ProductDeleteConflictException,
} from './products.errors';
import { QueryProductDto, UpdateProductDto } from './dto/product.dto';
import { createPaginatedResponse } from '../core/dto/pagination.dto';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a product enforcing tenant isolation, category ownership, and SKU invariants.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    input: CreateProductInput,
    requestId?: string,
  ): Promise<ProductDto> {
    if (!organizationId) {
      throw new InvalidCategoryReferenceException('Organization context is required');
    }

    if (!input.categoryId) {
      throw new InvalidCategoryReferenceException('Category ID is required');
    }

    // 1. Verify Category belongs to the same Organization
    const category = await this.prisma.category.findFirst({
      where: {
        id: input.categoryId,
        organizationId,
      },
    });

    if (!category) {
      throw new InvalidCategoryReferenceException(
        `Category "${input.categoryId}" does not exist in this organization`,
      );
    }

    // 2. Validate and normalize inputs
    const sku = ProductValidator.normalizeSku(input.sku);
    const name = ProductValidator.validateName(input.name);
    const description = ProductValidator.validateDescription(input.description);
    const unitOfMeasure = ProductValidator.validateUnitOfMeasure(input.unitOfMeasure);
    const status = ProductValidator.validateStatus(input.status);

    // 3. Verify SKU uniqueness within organization
    const existingSku = await this.prisma.product.findFirst({
      where: {
        organizationId,
        sku,
      },
    });

    if (existingSku) {
      throw new ProductDuplicateSkuException(
        `A product with SKU "${sku}" already exists in this organization`,
      );
    }

    // 4. Create product with composite foreign key reference
    let product: Product & { category?: Category | null };
    try {
      product = await this.prisma.product.create({
        data: {
          organizationId,
          categoryId: category.id,
          name,
          sku,
          description,
          unitOfMeasure,
          status,
        },
        include: { category: true },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2003'
      ) {
        throw new InvalidCategoryReferenceException(
          'Database constraint violation: referenced category does not exist in the active organization',
        );
      }
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        throw new ProductDuplicateSkuException(
          `A product with SKU "${sku}" already exists in this organization`,
        );
      }
      throw err;
    }

    // 5. Audit event
    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'product.created',
      entityType: 'Product',
      entityId: product.id,
      metadata: {
        sku: product.sku,
        name: product.name,
        categoryId: product.categoryId,
        unitOfMeasure: product.unitOfMeasure,
        status: product.status,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.formatProduct(product);
  }

  /**
   * Paginated, searchable, filterable, and sortable listing of products for the active organization.
   */
  async findAll(
    organizationId: string,
    query: QueryProductDto,
    requestId?: string,
  ): Promise<PaginatedResponse<ProductDto>> {
    const where: Prisma.ProductWhereInput = { organizationId };

    if (query.search && query.search.trim() !== '') {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.unitOfMeasure) {
      where.unitOfMeasure = query.unitOfMeasure;
    }

    const sortBy = query.getSafeSortBy();
    const sortOrder = query.sortOrder || 'desc';

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip: query.getSkip(),
        take: query.getTake(),
        orderBy: { [sortBy]: sortOrder },
        include: { category: true },
      }),
    ]);

    return createPaginatedResponse(
      products.map((prod) => this.formatProduct(prod)),
      total,
      query.page,
      query.limit,
      requestId,
    );
  }

  /**
   * Strict tenant-scoped lookup by ID. Throws 404 if not found or cross-tenant.
   */
  async findOne(id: string, organizationId: string): Promise<ProductDto> {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });

    if (!product) {
      throw new ProductNotFoundException();
    }

    return this.formatProduct(product);
  }

  /**
   * Optional scoped lookup by ID returning null when not found.
   */
  async findById(id: string, organizationId: string): Promise<ProductDto | null> {
    const product = await this.prisma.product.findFirst({
      where: { id, organizationId },
      include: { category: true },
    });

    return product ? this.formatProduct(product) : null;
  }

  /**
   * Strict tenant-scoped lookup by SKU. Throws 404 if not found.
   */
  async getBySku(rawSku: string, organizationId: string): Promise<ProductDto> {
    const sku = ProductValidator.normalizeSku(rawSku);
    const product = await this.prisma.product.findFirst({
      where: { organizationId, sku },
      include: { category: true },
    });

    if (!product) {
      throw new ProductNotFoundException(`Product with SKU "${sku}" not found`);
    }

    return this.formatProduct(product);
  }

  /**
   * Scoped lookup by SKU returning null if not found.
   */
  async findBySku(rawSku: string, organizationId: string): Promise<ProductDto | null> {
    const sku = ProductValidator.normalizeSku(rawSku);
    const product = await this.prisma.product.findFirst({
      where: { organizationId, sku },
      include: { category: true },
    });

    return product ? this.formatProduct(product) : null;
  }

  /**
   * Updates an existing product with tenant isolation, category validation, SKU uniqueness, and audit logging.
   */
  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    dto: UpdateProductDto,
    requestId?: string,
  ): Promise<ProductDto> {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new ProductNotFoundException();
    }

    const data: Prisma.ProductUpdateInput = {};

    // 1. Category validation if changing category
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, organizationId },
      });

      if (!category) {
        throw new InvalidCategoryReferenceException(
          `Category "${dto.categoryId}" does not exist in this organization`,
        );
      }
      data.category = {
        connect: {
          organizationId_id: {
            organizationId,
            id: dto.categoryId,
          },
        },
      };
    }

    // 2. SKU normalization and duplicate check if changing SKU
    if (dto.sku !== undefined) {
      const normalizedSku = ProductValidator.normalizeSku(dto.sku);
      if (normalizedSku !== existing.sku) {
        const duplicate = await this.prisma.product.findFirst({
          where: {
            organizationId,
            sku: normalizedSku,
            id: { not: id },
          },
        });

        if (duplicate) {
          throw new ProductDuplicateSkuException(
            `A product with SKU "${normalizedSku}" already exists in this organization`,
          );
        }
      }
      data.sku = normalizedSku;
    }

    // 3. Name validation
    if (dto.name !== undefined) {
      data.name = ProductValidator.validateName(dto.name);
    }

    // 4. Description validation
    if (dto.description !== undefined) {
      data.description = ProductValidator.validateDescription(dto.description);
    }

    // 5. Unit of Measure validation
    if (dto.unitOfMeasure !== undefined) {
      data.unitOfMeasure = ProductValidator.validateUnitOfMeasure(dto.unitOfMeasure);
    }

    // 6. Status validation
    if (dto.status !== undefined) {
      data.status = ProductValidator.validateStatus(dto.status);
    }

    let updated: Product & { category?: Category | null };
    try {
      updated = await this.prisma.product.update({
        where: { id },
        data,
        include: { category: true },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2003'
      ) {
        throw new InvalidCategoryReferenceException(
          'Database constraint violation: referenced category does not exist in the active organization',
        );
      }
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2002'
      ) {
        throw new ProductDuplicateSkuException(
          'A product with this SKU already exists in this organization',
        );
      }
      throw err;
    }

    // Audit Event
    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'product.updated',
      entityType: 'Product',
      entityId: id,
      metadata: {
        changedFields: Object.keys(dto),
        ...(dto.status !== undefined
          ? { previousStatus: existing.status, newStatus: updated.status }
          : {}),
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.formatProduct(updated);
  }

  /**
   * Updates product lifecycle status directly.
   */
  async updateStatus(
    id: string,
    organizationId: string,
    actorUserId: string,
    rawStatus: ProductStatus,
    requestId?: string,
  ): Promise<ProductDto> {
    return this.update(id, organizationId, actorUserId, { status: rawStatus }, requestId);
  }

  /**
   * Deletes a product enforcing tenant isolation, referential conflict protection, and audit logging.
   */
  async delete(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<{ message: string; id: string }> {
    const existing = await this.prisma.product.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new ProductNotFoundException();
    }

    try {
      await this.prisma.product.delete({
        where: { id },
      });
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2003'
      ) {
        throw new ProductDeleteConflictException(
          'Cannot delete product because it is referenced by other resources',
        );
      }
      throw err;
    }

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'product.deleted',
      entityType: 'Product',
      entityId: id,
      metadata: {
        sku: existing.sku,
        name: existing.name,
      },
      ...(requestId ? { requestId } : {}),
    });

    return { message: 'Product deleted successfully', id };
  }

  public formatProduct(product: Product & { category?: Category | null }): ProductDto {
    return {
      id: product.id,
      organizationId: product.organizationId,
      categoryId: product.categoryId,
      name: product.name,
      sku: product.sku,
      description: product.description,
      unitOfMeasure: product.unitOfMeasure,
      status: product.status,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      ...(product.category
        ? {
            category: {
              id: product.category.id,
              organizationId: product.category.organizationId,
              name: product.category.name,
              description: product.category.description,
              createdAt: product.category.createdAt.toISOString(),
              updatedAt: product.category.updatedAt.toISOString(),
            },
          }
        : {}),
    };
  }
}
