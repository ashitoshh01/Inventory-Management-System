import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@repo/database';
import { StockBalanceDto, StockLedgerEntryDto, PaginatedResponse } from '@repo/types';
import { CreateLedgerEntryInput, StockBalanceFilter, StockLedgerEntryFilter } from './stock.types';
import { StockQuantityValidator } from './stock.quantity';
import { createPaginatedResponse } from '../core/dto/pagination.dto';
import { QueryStockBalanceDto, QueryStockLedgerDto } from './dto/stock.dto';
import { StockProductNotFoundException, StockWarehouseNotFoundException } from './stock.errors';

@Injectable()
export class StockFoundationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves stock balance by ID for a specific organization.
   * Scoped strictly by organizationId for IDOR and tenant isolation.
   */
  async findById(
    organizationId: string,
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockBalanceDto | null> {
    const balance = await client.stockBalance.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!balance) {
      return null;
    }

    return this.mapBalanceToDto(balance);
  }

  /**
   * Paginated, filtered, and sorted listing of stock balances for the active organization.
   */
  async findPaginatedBalances(
    organizationId: string,
    query: QueryStockBalanceDto,
    requestId?: string,
  ): Promise<PaginatedResponse<StockBalanceDto>> {
    const where: Prisma.StockBalanceWhereInput = {
      organizationId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    };

    const sortBy = query.getSafeSortBy();
    const sortOrder = query.sortOrder || 'desc';

    const [total, balances] = await Promise.all([
      this.prisma.stockBalance.count({ where }),
      this.prisma.stockBalance.findMany({
        where,
        skip: query.getSkip(),
        take: query.getTake(),
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return createPaginatedResponse(
      balances.map((b) => this.mapBalanceToDto(b)),
      total,
      query.page,
      query.limit,
      requestId,
    );
  }

  /**
   * Retrieves all stock balances for a given product within the active organization.
   * Throws StockProductNotFoundException if the product does not exist in the tenant.
   */
  async findByProduct(organizationId: string, productId: string): Promise<StockBalanceDto[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, organizationId },
      select: { id: true },
    });
    if (!product) {
      throw new StockProductNotFoundException('Product not found in this organization');
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: { organizationId, productId },
      orderBy: { warehouseId: 'asc' },
    });

    return balances.map((b) => this.mapBalanceToDto(b));
  }

  /**
   * Retrieves all stock balances for a given warehouse within the active organization.
   * Throws StockWarehouseNotFoundException if the warehouse does not exist in the tenant.
   */
  async findByWarehouse(organizationId: string, warehouseId: string): Promise<StockBalanceDto[]> {
    const warehouse = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, organizationId },
      select: { id: true },
    });
    if (!warehouse) {
      throw new StockWarehouseNotFoundException('Warehouse not found in this organization');
    }

    const balances = await this.prisma.stockBalance.findMany({
      where: { organizationId, warehouseId },
      orderBy: { productId: 'asc' },
    });

    return balances.map((b) => this.mapBalanceToDto(b));
  }

  /**
   * Paginated, filtered, and sorted listing of stock ledger entries for the active organization.
   */
  async findPaginatedLedger(
    organizationId: string,
    query: QueryStockLedgerDto,
    requestId?: string,
  ): Promise<PaginatedResponse<StockLedgerEntryDto>> {
    const where: Prisma.StockLedgerEntryWhereInput = {
      organizationId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.type ? { type: query.type } : {}),
    };

    const sortBy = query.getSafeSortBy();
    const sortOrder = query.sortOrder || 'desc';

    const [total, entries] = await Promise.all([
      this.prisma.stockLedgerEntry.count({ where }),
      this.prisma.stockLedgerEntry.findMany({
        where,
        skip: query.getSkip(),
        take: query.getTake(),
        orderBy: { [sortBy]: sortOrder },
      }),
    ]);

    return createPaginatedResponse(
      entries.map((e) => this.mapLedgerEntryToDto(e)),
      total,
      query.page,
      query.limit,
      requestId,
    );
  }

  /**
   * Retrieves a single stock ledger entry by ID for the active organization.
   * Scoped strictly by organizationId for IDOR and tenant isolation.
   */
  async findLedgerById(
    organizationId: string,
    id: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockLedgerEntryDto | null> {
    const entry = await client.stockLedgerEntry.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!entry) {
      return null;
    }

    return this.mapLedgerEntryToDto(entry);
  }

  /**
   * Retrieves current stock balance for a specific product and warehouse within an organization.
   * Scoped strictly by organizationId for IDOR and tenant isolation.
   */
  async getBalance(
    organizationId: string,
    productId: string,
    warehouseId: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockBalanceDto | null> {
    const balance = await client.stockBalance.findUnique({
      where: {
        organizationId_productId_warehouseId: {
          organizationId,
          productId,
          warehouseId,
        },
      },
    });

    if (!balance) {
      return null;
    }

    return this.mapBalanceToDto(balance);
  }

  /**
   * Lists stock balances for an organization with optional product or warehouse filtering.
   */
  async listBalances(
    organizationId: string,
    filter?: StockBalanceFilter,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockBalanceDto[]> {
    const where: Prisma.StockBalanceWhereInput = {
      organizationId,
      ...(filter?.productId ? { productId: filter.productId } : {}),
      ...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
    };

    const balances = await client.stockBalance.findMany({
      where,
      orderBy: [{ productId: 'asc' }, { warehouseId: 'asc' }],
    });

    return balances.map((b) => this.mapBalanceToDto(b));
  }

  /**
   * Queries chronological ledger history for an organization with optional filters.
   */
  async getLedgerEntries(
    organizationId: string,
    filter?: StockLedgerEntryFilter,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockLedgerEntryDto[]> {
    const where: Prisma.StockLedgerEntryWhereInput = {
      organizationId,
      ...(filter?.productId ? { productId: filter.productId } : {}),
      ...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.idempotencyKey ? { idempotencyKey: filter.idempotencyKey } : {}),
    };

    const entries = await client.stockLedgerEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter?.limit ?? 100,
    });

    return entries.map((e) => this.mapLedgerEntryToDto(e));
  }

  /**
   * Appends an immutable stock ledger entry.
   * Enforces 4-decimal precision, non-zero deltas, and mathematical consistency.
   *
   * ARCHITECTURAL INVARIANT:
   * StockLedgerEntry is strictly append-only.
   * No update or delete operations are provided by this domain service.
   */
  async recordLedgerEntry(
    organizationId: string,
    input: CreateLedgerEntryInput,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ): Promise<StockLedgerEntryDto> {
    // 1. Validate domain math and precision
    StockQuantityValidator.validateLedgerMath(
      input.quantityBefore,
      input.quantityDelta,
      input.quantityAfter,
    );

    const normDelta = StockQuantityValidator.validatePrecision(input.quantityDelta);
    const normBefore = StockQuantityValidator.validatePrecision(input.quantityBefore);
    const normAfter = StockQuantityValidator.validatePrecision(input.quantityAfter);

    // 2. Persist append-only record
    const entry = await client.stockLedgerEntry.create({
      data: {
        organizationId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantityDelta: new Prisma.Decimal(normDelta),
        quantityBefore: new Prisma.Decimal(normBefore),
        quantityAfter: new Prisma.Decimal(normAfter),
        type: input.type,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        createdById: input.createdById ?? null,
        metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : Prisma.DbNull,
      },
    });

    return this.mapLedgerEntryToDto(entry);
  }

  private mapBalanceToDto(balance: {
    id: string;
    organizationId: string;
    productId: string;
    warehouseId: string;
    quantity: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
  }): StockBalanceDto {
    return {
      id: balance.id,
      organizationId: balance.organizationId,
      productId: balance.productId,
      warehouseId: balance.warehouseId,
      quantity: balance.quantity.toFixed(StockQuantityValidator.MAX_SCALE),
      createdAt: balance.createdAt.toISOString(),
      updatedAt: balance.updatedAt.toISOString(),
    };
  }

  private mapLedgerEntryToDto(entry: {
    id: string;
    organizationId: string;
    productId: string;
    warehouseId: string;
    quantityDelta: Prisma.Decimal;
    quantityBefore: Prisma.Decimal;
    quantityAfter: Prisma.Decimal;
    type: string;
    referenceType: string | null;
    referenceId: string | null;
    idempotencyKey: string | null;
    createdById: string | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): StockLedgerEntryDto {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      productId: entry.productId,
      warehouseId: entry.warehouseId,
      quantityDelta: entry.quantityDelta.toFixed(StockQuantityValidator.MAX_SCALE),
      quantityBefore: entry.quantityBefore.toFixed(StockQuantityValidator.MAX_SCALE),
      quantityAfter: entry.quantityAfter.toFixed(StockQuantityValidator.MAX_SCALE),
      type: entry.type as StockLedgerEntryDto['type'],
      referenceType: entry.referenceType,
      referenceId: entry.referenceId,
      idempotencyKey: entry.idempotencyKey,
      createdById: entry.createdById,
      metadata: entry.metadata as Record<string, unknown> | null,
      createdAt: entry.createdAt.toISOString(),
    };
  }
}
