import { Injectable } from '@nestjs/common';
import { PrismaService, Warehouse, Prisma } from '@repo/database';
import {
  WarehouseDto,
  CreateWarehouseInput,
  UpdateWarehouseInput,
  WarehouseQueryParams,
  WarehouseStatus,
  ALLOWED_WAREHOUSE_SORT_FIELDS,
  PaginatedResponse,
} from '@repo/types';
import { AuditService } from '../audit/audit.service';
import { WarehouseValidator } from './warehouses.validator';
import {
  WarehouseNotFoundException,
  WarehouseDuplicateNameException,
  WarehouseDuplicateCodeException,
  WarehouseDeleteConflictException,
  WarehouseValidationException,
} from './warehouses.errors';
import { createPaginatedResponse } from '../core/dto/pagination.dto';

@Injectable()
export class WarehousesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Creates a warehouse enforcing tenant isolation, unique name/code, and default warehouse invariants.
   */
  async create(
    organizationId: string,
    actorUserId: string,
    input: CreateWarehouseInput,
    requestId?: string,
  ): Promise<WarehouseDto> {
    if (!organizationId) {
      throw new WarehouseValidationException('Organization context is required');
    }

    const name = WarehouseValidator.validateName(input.name);
    const code = WarehouseValidator.normalizeCode(input.code);
    const description = WarehouseValidator.validateDescription(input.description);
    const addressLine1 = WarehouseValidator.validateAddressField(
      'Address line 1',
      input.addressLine1,
    );
    const addressLine2 = WarehouseValidator.validateAddressField(
      'Address line 2',
      input.addressLine2,
    );
    const city = WarehouseValidator.validateAddressField('City', input.city);
    const state = WarehouseValidator.validateAddressField('State', input.state);
    const postalCode = WarehouseValidator.validateAddressField('Postal code', input.postalCode);
    const country = WarehouseValidator.validateAddressField('Country', input.country);
    const status = WarehouseValidator.validateStatus(input.status);

    // Verify name uniqueness within organization
    const existingName = await this.prisma.warehouse.findFirst({
      where: {
        organizationId,
        name: { equals: name, mode: 'insensitive' },
      },
    });

    if (existingName) {
      throw new WarehouseDuplicateNameException(
        `A warehouse with name "${name}" already exists in this organization`,
      );
    }

    // Verify code uniqueness within organization
    const existingCode = await this.prisma.warehouse.findFirst({
      where: {
        organizationId,
        code,
      },
    });

    if (existingCode) {
      throw new WarehouseDuplicateCodeException(
        `A warehouse with code "${code}" already exists in this organization`,
      );
    }

    // Check if this is the first warehouse for the organization
    const existingCount = await this.prisma.warehouse.count({
      where: { organizationId },
    });

    // If first warehouse, automatically make it default unless explicitly false; otherwise respect input
    const isDefault = existingCount === 0 ? (input.isDefault ?? true) : (input.isDefault ?? false);

    const warehouse = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Enforce transaction-level row lock on the organization to serialize concurrent default assignment
        if (typeof tx.$executeRaw === 'function') {
          await tx.$executeRaw`SELECT 1 FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
        }
        // Reset any existing default warehouses for this organization
        await tx.warehouse.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.create({
        data: {
          organizationId,
          name,
          code,
          description,
          addressLine1,
          addressLine2,
          city,
          state,
          postalCode,
          country,
          status,
          isDefault,
        },
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'warehouse.created',
      entityType: 'Warehouse',
      entityId: warehouse.id,
      metadata: {
        code: warehouse.code,
        name: warehouse.name,
        isDefault: warehouse.isDefault,
        status: warehouse.status,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.mapToDto(warehouse);
  }

  /**
   * Retrieves a paginated list of warehouses for the organization.
   */
  async findAll(
    organizationId: string,
    query?: WarehouseQueryParams,
    requestId?: string,
  ): Promise<PaginatedResponse<WarehouseDto>> {
    const page = Math.max(1, query?.page ?? 1);
    const limit = Math.min(100, Math.max(1, query?.limit ?? 20));
    const skip = (page - 1) * limit;
    const sortBy =
      query?.sortBy && (ALLOWED_WAREHOUSE_SORT_FIELDS as readonly string[]).includes(query.sortBy)
        ? query.sortBy
        : 'createdAt';
    const sortOrder = query?.sortOrder === 'asc' ? 'asc' : 'desc';

    const where: Prisma.WarehouseWhereInput = {
      organizationId,
    };

    if (query?.status) {
      where.status = query.status;
    }

    if (query?.search) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, warehouses] = await Promise.all([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    const dtos = warehouses.map((w) => this.mapToDto(w));
    return createPaginatedResponse(dtos, total, page, limit, requestId);
  }

  /**
   * Retrieves a single warehouse by ID enforcing tenant isolation.
   */
  async findOne(id: string, organizationId: string): Promise<WarehouseDto> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!warehouse) {
      throw new WarehouseNotFoundException(`Warehouse "${id}" not found`);
    }

    return this.mapToDto(warehouse);
  }

  /**
   * Alias for findOne to support findById convention.
   */
  async findById(id: string, organizationId: string): Promise<WarehouseDto> {
    return this.findOne(id, organizationId);
  }

  /**
   * Retrieves a single warehouse by unique code enforcing tenant isolation.
   */
  async findByCode(code: string, organizationId: string): Promise<WarehouseDto> {
    const normalizedCode = WarehouseValidator.normalizeCode(code);
    const warehouse = await this.prisma.warehouse.findFirst({
      where: {
        code: normalizedCode,
        organizationId,
      },
    });

    if (!warehouse) {
      throw new WarehouseNotFoundException(`Warehouse with code "${code}" not found`);
    }

    return this.mapToDto(warehouse);
  }

  /**
   * Updates a warehouse enforcing tenant ownership, unique invariants, and transactional default switching.
   */
  async update(
    id: string,
    organizationId: string,
    actorUserId: string,
    input: UpdateWarehouseInput,
    requestId?: string,
  ): Promise<WarehouseDto> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new WarehouseNotFoundException(`Warehouse "${id}" not found`);
    }

    const updateData: Prisma.WarehouseUpdateInput = {};

    // Validate and check name uniqueness if provided
    if (input.name !== undefined) {
      const name = WarehouseValidator.validateName(input.name);
      const duplicateName = await this.prisma.warehouse.findFirst({
        where: {
          organizationId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id },
        },
      });

      if (duplicateName) {
        throw new WarehouseDuplicateNameException(
          `A warehouse with name "${name}" already exists in this organization`,
        );
      }
      updateData.name = name;
    }

    // Validate and check code uniqueness if provided
    if (input.code !== undefined) {
      const code = WarehouseValidator.normalizeCode(input.code);
      const duplicateCode = await this.prisma.warehouse.findFirst({
        where: {
          organizationId,
          code,
          id: { not: id },
        },
      });

      if (duplicateCode) {
        throw new WarehouseDuplicateCodeException(
          `A warehouse with code "${code}" already exists in this organization`,
        );
      }
      updateData.code = code;
    }

    if (input.description !== undefined) {
      updateData.description = WarehouseValidator.validateDescription(input.description);
    }

    if (input.addressLine1 !== undefined) {
      updateData.addressLine1 = WarehouseValidator.validateAddressField(
        'Address line 1',
        input.addressLine1,
      );
    }

    if (input.addressLine2 !== undefined) {
      updateData.addressLine2 = WarehouseValidator.validateAddressField(
        'Address line 2',
        input.addressLine2,
      );
    }

    if (input.city !== undefined) {
      updateData.city = WarehouseValidator.validateAddressField('City', input.city);
    }

    if (input.state !== undefined) {
      updateData.state = WarehouseValidator.validateAddressField('State', input.state);
    }

    if (input.postalCode !== undefined) {
      updateData.postalCode = WarehouseValidator.validateAddressField(
        'Postal code',
        input.postalCode,
      );
    }

    if (input.country !== undefined) {
      updateData.country = WarehouseValidator.validateAddressField('Country', input.country);
    }

    if (input.status !== undefined) {
      updateData.status = WarehouseValidator.validateStatus(input.status);
    }

    const settingDefault = input.isDefault === true;
    if (input.isDefault !== undefined) {
      updateData.isDefault = input.isDefault;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (settingDefault) {
        // Enforce transaction-level row lock on the organization to serialize concurrent default switching
        if (typeof tx.$executeRaw === 'function') {
          await tx.$executeRaw`SELECT 1 FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
        }
        await tx.warehouse.updateMany({
          where: { organizationId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return tx.warehouse.update({
        where: { id },
        data: updateData,
      });
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'warehouse.updated',
      entityType: 'Warehouse',
      entityId: updated.id,
      metadata: {
        changes: updateData,
      },
      ...(requestId ? { requestId } : {}),
    });

    return this.mapToDto(updated);
  }

  /**
   * Deletes a warehouse enforcing tenant isolation and business constraints.
   */
  async delete(
    id: string,
    organizationId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<void> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id, organizationId },
    });

    if (!warehouse) {
      throw new WarehouseNotFoundException(`Warehouse "${id}" not found`);
    }

    if (warehouse.isDefault) {
      throw new WarehouseDeleteConflictException(
        'Cannot delete warehouse because it is designated as the default warehouse',
      );
    }

    await this.prisma.warehouse.delete({
      where: { id },
    });

    await this.auditService.logEvent({
      organizationId,
      actorUserId,
      action: 'warehouse.deleted',
      entityType: 'Warehouse',
      entityId: id,
      metadata: {
        code: warehouse.code,
        name: warehouse.name,
      },
      ...(requestId ? { requestId } : {}),
    });
  }

  private mapToDto(warehouse: Warehouse): WarehouseDto {
    return {
      id: warehouse.id,
      organizationId: warehouse.organizationId,
      name: warehouse.name,
      code: warehouse.code,
      description: warehouse.description,
      addressLine1: warehouse.addressLine1,
      addressLine2: warehouse.addressLine2,
      city: warehouse.city,
      state: warehouse.state,
      postalCode: warehouse.postalCode,
      country: warehouse.country,
      status: warehouse.status as WarehouseStatus,
      isDefault: warehouse.isDefault,
      createdAt: warehouse.createdAt.toISOString(),
      updatedAt: warehouse.updatedAt.toISOString(),
    };
  }
}
