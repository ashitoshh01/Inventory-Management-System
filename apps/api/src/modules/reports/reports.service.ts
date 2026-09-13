import { Injectable, Optional, NotFoundException, BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService, Prisma } from '@repo/database';
import type {
  StockMovementReportResponseDto,
  StockMovementReportItemDto,
  InventoryValuationReportResponseDto,
  InventoryValuationItemDto,
  ReconciliationReportResponseDto,
  ReconciliationItemDto,
  ProcurementReportResponseDto,
  ProcurementReportItemDto,
  SalesReportResponseDto,
  SalesReportItemDto,
  ExportJobDto,
  ExportJobResponseDto,
} from '@repo/types';
import { QueryReportDto, ExportReportDto } from './dto/reports-query.dto';
import { QueueService } from '../queue/queue.service';
import { EXPORTS_STORAGE_DIR } from './reports.constants';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

  /**
   * 1. Stock Movement Report
   * Authoritative source: immutable StockLedgerEntry.
   */
  async getStockMovementReport(
    organizationId: string,
    query: QueryReportDto,
  ): Promise<StockMovementReportResponseDto> {
    const where: Prisma.StockLedgerEntryWhereInput = {
      organizationId,
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.type ? { type: query.type as any } : {}),
      ...(query.startDate || query.endDate
        ? {
            createdAt: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, entries, agg] = await Promise.all([
      this.prisma.stockLedgerEntry.count({ where }),
      this.prisma.stockLedgerEntry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: (query.sortOrder?.toLowerCase() as 'asc' | 'desc') || 'desc' },
        include: {
          product: { select: { name: true, sku: true } },
          warehouse: { select: { name: true, code: true } },
          creator: { select: { email: true } },
        },
      }),
      this.prisma.stockLedgerEntry.aggregate({
        where,
        _sum: { quantityDelta: true },
        _count: { id: true },
      }),
    ]);

    // Compute separate total in and total out
    const inAgg = await this.prisma.stockLedgerEntry.aggregate({
      where: { ...where, quantityDelta: { gt: 0 } },
      _sum: { quantityDelta: true },
    });
    const outAgg = await this.prisma.stockLedgerEntry.aggregate({
      where: { ...where, quantityDelta: { lt: 0 } },
      _sum: { quantityDelta: true },
    });

    const totalIn = inAgg._sum.quantityDelta ? inAgg._sum.quantityDelta.toFixed(4) : '0.0000';
    const totalOut = outAgg._sum.quantityDelta
      ? Math.abs(parseFloat(outAgg._sum.quantityDelta.toString())).toFixed(4)
      : '0.0000';
    const netChange = agg._sum.quantityDelta ? agg._sum.quantityDelta.toFixed(4) : '0.0000';

    const items: StockMovementReportItemDto[] = entries.map((e) => ({
      id: e.id,
      productId: e.productId,
      productName: e.product.name,
      productSku: e.product.sku,
      warehouseId: e.warehouseId,
      warehouseName: e.warehouse.name,
      warehouseCode: e.warehouse.code,
      type: e.type,
      quantityDelta: e.quantityDelta.toFixed(4),
      quantityBefore: e.quantityBefore.toFixed(4),
      quantityAfter: e.quantityAfter.toFixed(4),
      referenceType: e.referenceType,
      referenceId: e.referenceId,
      actorEmail: e.creator?.email ?? null,
      createdAt: e.createdAt.toISOString(),
    }));

    const limit = query.getTake();
    return {
      items,
      summary: {
        totalMovements: total,
        totalIn,
        totalOut,
        netChange,
      },
      total,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 2. Inventory Valuation Report
   * Authoritative source: StockBalance + Product (unitCost, unitPrice) + Category.
   */
  async getInventoryValuationReport(
    organizationId: string,
    query: QueryReportDto,
  ): Promise<InventoryValuationReportResponseDto> {
    const where: Prisma.StockBalanceWhereInput = {
      organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      product: {
        status: 'ACTIVE',
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, balances] = await Promise.all([
      this.prisma.stockBalance.count({ where }),
      this.prisma.stockBalance.findMany({
        where,
        skip,
        take,
        orderBy: [{ product: { name: 'asc' } }, { warehouse: { name: 'asc' } }],
        include: {
          product: {
            include: {
              category: { select: { name: true } },
            },
          },
          warehouse: { select: { name: true, code: true } },
        },
      }),
    ]);

    // Authoritative totals via SQL for whole filtered population
    const warehouseFilterSql = query.warehouseId
      ? Prisma.sql`AND sb."warehouseId" = ${query.warehouseId}`
      : Prisma.empty;
    const categoryFilterSql = query.categoryId
      ? Prisma.sql`AND p."categoryId" = ${query.categoryId}`
      : Prisma.empty;
    const searchFilterSql = query.search
      ? Prisma.sql`AND (p.name ILIKE ${'%' + query.search + '%'} OR p.sku ILIKE ${'%' + query.search + '%'})`
      : Prisma.empty;

    const summaryAgg = await this.prisma.$queryRaw<
      Array<{
        total_quantity: string | null;
        total_cost: string | null;
        total_retail: string | null;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(sb.quantity), 0)::text AS total_quantity,
        COALESCE(SUM(sb.quantity * COALESCE(p."unitCost", 0)), 0)::text AS total_cost,
        COALESCE(SUM(sb.quantity * COALESCE(p."unitPrice", 0)), 0)::text AS total_retail
      FROM "StockBalance" sb
      JOIN "Product" p ON p.id = sb."productId" AND p."organizationId" = sb."organizationId"
      WHERE sb."organizationId" = ${organizationId}
        AND p.status = 'ACTIVE'
        ${warehouseFilterSql}
        ${categoryFilterSql}
        ${searchFilterSql}
    `);

    const sRow = summaryAgg[0];

    const items: InventoryValuationItemDto[] = balances.map((b) => {
      const qty = parseFloat(b.quantity.toString());
      const cost = b.product.unitCost ? parseFloat(b.product.unitCost.toString()) : 0;
      const price = b.product.unitPrice ? parseFloat(b.product.unitPrice.toString()) : 0;
      const totalCostValue = (qty * cost).toFixed(2);
      const totalRetailValue = (qty * price).toFixed(2);

      let stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK';
      if (qty <= 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (qty <= 10) {
        stockStatus = 'LOW_STOCK';
      }

      return {
        productId: b.productId,
        productName: b.product.name,
        productSku: b.product.sku,
        categoryName: b.product.category.name,
        unitOfMeasure: b.product.unitOfMeasure,
        warehouseId: b.warehouseId,
        warehouseName: b.warehouse.name,
        warehouseCode: b.warehouse.code,
        quantity: b.quantity.toFixed(4),
        unitCost: cost.toFixed(2),
        unitPrice: price.toFixed(2),
        totalCostValue,
        totalRetailValue,
        stockStatus,
      };
    });

    const limit = query.getTake();
    return {
      items,
      summary: {
        totalItems: total,
        totalQuantity: parseFloat(sRow?.total_quantity ?? '0').toFixed(4),
        totalCostValue: parseFloat(sRow?.total_cost ?? '0').toFixed(2),
        totalRetailValue: parseFloat(sRow?.total_retail ?? '0').toFixed(2),
      },
      total,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Inventory Reconciliation Report
   * Read-only verification comparing StockBalance vs SUM(StockLedgerEntry.quantityDelta).
   */
  async getReconciliationReport(
    organizationId: string,
    query: QueryReportDto,
  ): Promise<ReconciliationReportResponseDto> {
    const warehouseFilterSql = query.warehouseId
      ? Prisma.sql`AND sb."warehouseId" = ${query.warehouseId}`
      : Prisma.empty;
    const productFilterSql = query.productId
      ? Prisma.sql`AND sb."productId" = ${query.productId}`
      : Prisma.empty;
    const discrepancyFilterSql = query.discrepancyOnly
      ? Prisma.sql`HAVING sb.quantity <> COALESCE(SUM(sle."quantityDelta"), 0)`
      : Prisma.empty;

    // Fetch all balance vs ledger aggregates for organization
    const rawRows = await this.prisma.$queryRaw<
      Array<{
        product_id: string;
        product_name: string;
        product_sku: string;
        warehouse_id: string;
        warehouse_name: string;
        warehouse_code: string;
        current_balance: string;
        ledger_sum: string;
        discrepancy: string;
        status: string;
        last_movement_at: Date | null;
        ledger_count: string;
      }>
    >(Prisma.sql`
      SELECT
        sb."productId" AS product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        sb."warehouseId" AS warehouse_id,
        w.name AS warehouse_name,
        w.code AS warehouse_code,
        sb.quantity::text AS current_balance,
        COALESCE(SUM(sle."quantityDelta"), 0)::text AS ledger_sum,
        (sb.quantity - COALESCE(SUM(sle."quantityDelta"), 0))::text AS discrepancy,
        CASE
          WHEN sb.quantity = COALESCE(SUM(sle."quantityDelta"), 0) THEN 'MATCH'
          ELSE 'DISCREPANCY'
        END AS status,
        MAX(sle."createdAt") AS last_movement_at,
        COUNT(sle.id)::text AS ledger_count
      FROM "StockBalance" sb
      JOIN "Product" p ON p.id = sb."productId" AND p."organizationId" = sb."organizationId"
      JOIN "Warehouse" w ON w.id = sb."warehouseId" AND w."organizationId" = sb."organizationId"
      LEFT JOIN "StockLedgerEntry" sle ON sle."productId" = sb."productId"
        AND sle."warehouseId" = sb."warehouseId"
        AND sle."organizationId" = sb."organizationId"
      WHERE sb."organizationId" = ${organizationId}
        ${warehouseFilterSql}
        ${productFilterSql}
      GROUP BY sb."productId", p.name, p.sku, sb."warehouseId", w.name, w.code, sb.quantity
      ${discrepancyFilterSql}
      ORDER BY p.name ASC, w.name ASC
    `);

    const total = rawRows.length;
    const totalMatches = rawRows.filter((r) => r.status === 'MATCH').length;
    const totalDiscrepancies = rawRows.filter((r) => r.status === 'DISCREPANCY').length;

    // Offset pagination in memory over the aggregated set
    const skip = query.getSkip();
    const limit = query.getTake();
    const paged = rawRows.slice(skip, skip + limit);

    const items: ReconciliationItemDto[] = paged.map((r) => ({
      productId: r.product_id,
      productName: r.product_name,
      productSku: r.product_sku,
      warehouseId: r.warehouse_id,
      warehouseName: r.warehouse_name,
      warehouseCode: r.warehouse_code,
      currentBalance: parseFloat(r.current_balance).toFixed(4),
      ledgerDeltaSum: parseFloat(r.ledger_sum).toFixed(4),
      discrepancy: parseFloat(r.discrepancy).toFixed(4),
      status: r.status as 'MATCH' | 'DISCREPANCY',
      lastMovementAt: r.last_movement_at ? r.last_movement_at.toISOString() : null,
      ledgerEntriesCount: parseInt(r.ledger_count, 10),
    }));

    return {
      items,
      summary: {
        totalBuckets: total,
        totalMatches,
        totalDiscrepancies,
      },
      total,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 4. Procurement Report
   * Authoritative source: PurchaseOrder + lines.
   */
  async getProcurementReport(
    organizationId: string,
    query: QueryReportDto,
  ): Promise<ProcurementReportResponseDto> {
    const where: Prisma.PurchaseOrderWhereInput = {
      organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { purchaseOrderNumber: { contains: query.search, mode: 'insensitive' } },
              { supplierName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            orderDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, orders, agg] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take,
        orderBy: { orderDate: 'desc' },
        include: {
          warehouse: { select: { name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.purchaseOrder.aggregate({
        where,
        _sum: { grandTotal: true },
      }),
    ]);

    const receivedCount = await this.prisma.purchaseOrder.count({
      where: { ...where, status: 'RECEIVED' },
    });
    const pendingCount = total - receivedCount;

    const items: ProcurementReportItemDto[] = orders.map((o) => ({
      purchaseOrderId: o.id,
      purchaseOrderNumber: o.purchaseOrderNumber,
      supplierName: o.supplierName,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse.name,
      status: o.status,
      orderDate: o.orderDate.toISOString(),
      expectedDate: o.expectedDate ? o.expectedDate.toISOString() : null,
      grandTotal: o.grandTotal.toFixed(2),
      currency: o.currency,
      linesCount: o._count.lines,
    }));

    const limit = query.getTake();
    return {
      items,
      summary: {
        totalOrders: total,
        totalValue: agg._sum.grandTotal ? agg._sum.grandTotal.toFixed(2) : '0.00',
        receivedCount,
        pendingCount,
      },
      total,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 5. Sales Report
   * Authoritative source: SalesOrder.
   */
  async getSalesReport(
    organizationId: string,
    query: QueryReportDto,
  ): Promise<SalesReportResponseDto> {
    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search
        ? {
            OR: [
              { salesOrderNumber: { contains: query.search, mode: 'insensitive' } },
              { customerName: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.startDate || query.endDate
        ? {
            orderDate: {
              ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
              ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
            },
          }
        : {}),
    };

    const skip = query.getSkip();
    const take = query.getTake();

    const [total, orders, agg] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take,
        orderBy: { orderDate: 'desc' },
        include: {
          warehouse: { select: { name: true } },
          _count: { select: { lines: true } },
        },
      }),
      this.prisma.salesOrder.aggregate({
        where,
        _sum: { grandTotal: true },
      }),
    ]);

    const fulfilledCount = await this.prisma.salesOrder.count({
      where: { ...where, status: 'FULFILLED' },
    });
    const pendingOrders = total - fulfilledCount;

    const items: SalesReportItemDto[] = orders.map((o) => ({
      salesOrderId: o.id,
      salesOrderNumber: o.salesOrderNumber,
      customerName: o.customerName,
      warehouseId: o.warehouseId,
      warehouseName: o.warehouse.name,
      status: o.status,
      orderDate: o.orderDate.toISOString(),
      grandTotal: o.grandTotal.toFixed(2),
      currency: o.currency,
      linesCount: o._count.lines,
    }));

    const limit = query.getTake();
    return {
      items,
      summary: {
        totalOrders: total,
        totalRevenue: agg._sum.grandTotal ? agg._sum.grandTotal.toFixed(2) : '0.00',
        fulfilledOrders: fulfilledCount,
        pendingOrders,
      },
      total,
      page: query.page ?? 1,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 6. Generate real RFC 4180 CSV export string with security filters and summary metadata.
   */
  async generateReportCsvString(
    organizationId: string,
    query: ExportReportDto,
  ): Promise<{ csvString: string; rowCount: number; filename: string }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${query.reportType}-${timestamp}.csv`;
    const lines: string[] = [];

    const escapeCsv = (val: unknown): string => {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return `"${str}"`;
    };

    const writeLine = (fields: unknown[]) => {
      lines.push(fields.map(escapeCsv).join(','));
    };

    // Metadata header
    lines.push(`# Report: ${query.reportType.toUpperCase()}`);
    lines.push(`# Generated At: ${new Date().toISOString()}`);
    lines.push(`# Organization: ${organizationId}`);
    if (query.warehouseId) lines.push(`# Warehouse Filter: ${query.warehouseId}`);
    if (query.startDate) lines.push(`# Start Date: ${query.startDate}`);
    if (query.endDate) lines.push(`# End Date: ${query.endDate}`);
    lines.push('');

    // Unpaginated export (up to safe bounds, e.g. 5000 rows)
    const exportLimitDto: QueryReportDto = { ...query, page: 1, limit: 5000, getSkip: () => 0, getTake: () => 5000 };
    let rowCount = 0;

    switch (query.reportType) {
      case 'stock-movement': {
        const data = await this.getStockMovementReport(organizationId, exportLimitDto);
        rowCount = data.items.length;
        writeLine([
          'Date',
          'Product SKU',
          'Product Name',
          'Warehouse Code',
          'Warehouse Name',
          'Mutation Type',
          'Quantity Delta',
          'Quantity Before',
          'Quantity After',
          'Reference Type',
          'Reference ID',
          'Actor',
        ]);
        for (const item of data.items) {
          writeLine([
            item.createdAt,
            item.productSku,
            item.productName,
            item.warehouseCode,
            item.warehouseName,
            item.type,
            item.quantityDelta,
            item.quantityBefore,
            item.quantityAfter,
            item.referenceType ?? '',
            item.referenceId ?? '',
            item.actorEmail ?? '',
          ]);
        }
        lines.push('');
        writeLine([
          'TOTAL MOVEMENTS',
          data.summary.totalMovements,
          'TOTAL IN',
          data.summary.totalIn,
          'TOTAL OUT',
          data.summary.totalOut,
          'NET CHANGE',
          data.summary.netChange,
        ]);
        break;
      }

      case 'inventory-valuation': {
        const data = await this.getInventoryValuationReport(organizationId, exportLimitDto);
        rowCount = data.items.length;
        writeLine([
          'Product SKU',
          'Product Name',
          'Category',
          'Warehouse Code',
          'Warehouse Name',
          'Quantity On Hand',
          'Unit Of Measure',
          'Unit Cost',
          'Unit Price',
          'Total Cost Value',
          'Total Retail Value',
          'Stock Status',
        ]);
        for (const item of data.items) {
          writeLine([
            item.productSku,
            item.productName,
            item.categoryName,
            item.warehouseCode,
            item.warehouseName,
            item.quantity,
            item.unitOfMeasure,
            item.unitCost,
            item.unitPrice,
            item.totalCostValue,
            item.totalRetailValue,
            item.stockStatus,
          ]);
        }
        lines.push('');
        writeLine([
          'TOTAL ITEMS',
          data.summary.totalItems,
          'TOTAL QUANTITY',
          data.summary.totalQuantity,
          'TOTAL COST VALUE',
          data.summary.totalCostValue,
          'TOTAL RETAIL VALUE',
          data.summary.totalRetailValue,
        ]);
        break;
      }

      case 'reconciliation': {
        const data = await this.getReconciliationReport(organizationId, exportLimitDto);
        rowCount = data.items.length;
        writeLine([
          'Product SKU',
          'Product Name',
          'Warehouse Code',
          'Warehouse Name',
          'Current Balance',
          'Ledger Delta Sum',
          'Discrepancy',
          'Status',
          'Last Movement Date',
          'Total Ledger Entries',
        ]);
        for (const item of data.items) {
          writeLine([
            item.productSku,
            item.productName,
            item.warehouseCode,
            item.warehouseName,
            item.currentBalance,
            item.ledgerDeltaSum,
            item.discrepancy,
            item.status,
            item.lastMovementAt ?? '',
            item.ledgerEntriesCount,
          ]);
        }
        lines.push('');
        writeLine([
          'TOTAL CHECKED',
          data.summary.totalBuckets,
          'MATCHES',
          data.summary.totalMatches,
          'DISCREPANCIES',
          data.summary.totalDiscrepancies,
        ]);
        break;
      }

      case 'procurement': {
        const data = await this.getProcurementReport(organizationId, exportLimitDto);
        rowCount = data.items.length;
        writeLine([
          'PO Number',
          'Supplier',
          'Warehouse',
          'Status',
          'Order Date',
          'Expected Date',
          'Currency',
          'Grand Total',
          'Lines Count',
        ]);
        for (const item of data.items) {
          writeLine([
            item.purchaseOrderNumber,
            item.supplierName,
            item.warehouseName,
            item.status,
            item.orderDate,
            item.expectedDate ?? '',
            item.currency,
            item.grandTotal,
            item.linesCount,
          ]);
        }
        lines.push('');
        writeLine([
          'TOTAL ORDERS',
          data.summary.totalOrders,
          'TOTAL VALUE',
          data.summary.totalValue,
          'RECEIVED COUNT',
          data.summary.receivedCount,
          'PENDING COUNT',
          data.summary.pendingCount,
        ]);
        break;
      }

      case 'sales': {
        const data = await this.getSalesReport(organizationId, exportLimitDto);
        rowCount = data.items.length;
        writeLine([
          'Order Number',
          'Customer',
          'Warehouse',
          'Status',
          'Order Date',
          'Currency',
          'Grand Total',
          'Lines Count',
        ]);
        for (const item of data.items) {
          writeLine([
            item.salesOrderNumber,
            item.customerName,
            item.warehouseName,
            item.status,
            item.orderDate,
            item.currency,
            item.grandTotal,
            item.linesCount,
          ]);
        }
        lines.push('');
        writeLine([
          'TOTAL ORDERS',
          data.summary.totalOrders,
          'TOTAL REVENUE',
          data.summary.totalRevenue,
          'FULFILLED ORDERS',
          data.summary.fulfilledOrders,
          'PENDING ORDERS',
          data.summary.pendingOrders,
        ]);
        break;
      }
    }

    return {
      csvString: lines.join('\r\n') + '\r\n',
      rowCount,
      filename,
    };
  }

  /**
   * Stream real RFC 4180 CSV export response.
   */
  async exportReportCsv(organizationId: string, query: ExportReportDto, res: Response): Promise<void> {
    const { csvString, filename } = await this.generateReportCsvString(organizationId, query);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    if (typeof res.send === 'function') {
      res.send(csvString);
    } else {
      res.write(csvString);
      res.end();
    }
  }

  /**
   * 7. Creates an asynchronous report export job and enqueues it in BullMQ.
   */
  async createAsyncExportJob(
    organizationId: string,
    userId: string,
    query: ExportReportDto,
  ): Promise<ExportJobResponseDto> {
    const exportJob = await this.prisma.exportJob.create({
      data: {
        organizationId,
        userId,
        reportType: query.reportType,
        status: 'PENDING',
        queryParams: JSON.parse(JSON.stringify(query)),
      },
    });

    if (this.queueService) {
      await this.queueService.enqueueReportExport({
        exportId: exportJob.id,
        organizationId,
        userId,
        reportType: query.reportType,
        queryParams: query,
      });
    }

    return {
      exportId: exportJob.id,
      status: exportJob.status,
      message: 'Report export job queued successfully',
      createdAt: exportJob.createdAt.toISOString(),
    };
  }

  /**
   * 8. Retrieves the status and details of an export job.
   */
  async getExportJob(organizationId: string, exportId: string): Promise<ExportJobDto> {
    const job = await this.prisma.exportJob.findFirst({
      where: {
        id: exportId,
        organizationId,
      },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${exportId} not found`);
    }

    return {
      id: job.id,
      organizationId: job.organizationId,
      userId: job.userId,
      reportType: job.reportType,
      status: job.status,
      queryParams: job.queryParams as any,
      fileName: job.fileName,
      fileSize: job.fileSize,
      rowCount: job.rowCount,
      errorMessage: job.errorMessage,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
    };
  }

  /**
   * 9. Resolves the physical path of a completed export file for download.
   */
  async getExportFilePath(
    organizationId: string,
    exportId: string,
  ): Promise<{ filePath: string; fileName: string }> {
    const job = await this.prisma.exportJob.findFirst({
      where: {
        id: exportId,
        organizationId,
      },
    });

    if (!job) {
      throw new NotFoundException(`Export job ${exportId} not found`);
    }

    if (job.status !== 'COMPLETED' || !job.fileName) {
      throw new BadRequestException(`Export is not ready for download (current status: ${job.status})`);
    }

    const filePath = path.join(EXPORTS_STORAGE_DIR, job.fileName);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Export file not found on disk or has expired');
    }

    return { filePath, fileName: job.fileName };
  }
}

