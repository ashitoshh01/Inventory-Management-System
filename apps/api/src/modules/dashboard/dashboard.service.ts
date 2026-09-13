import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';
import type {
  DashboardStatsDto,
  InventoryByCategoryDto,
  StockStatusOverviewDto,
  RecentActivityDto,
  DashboardQueryParams,
  SalesOverviewPointDto,
  TopSellingProductDto,
} from '@repo/types';

/** Low-stock threshold: product has stock > 0 and <= this value */
const LOW_STOCK_THRESHOLD = 10;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Dashboard summary statistics: total products, stock, low stock, out of stock, inventory value.
   */
  async getStats(
    organizationId: string,
    params?: DashboardQueryParams,
  ): Promise<DashboardStatsDto> {
    const warehouseFilter = params?.warehouseId
      ? Prisma.sql`AND sb."warehouseId" = ${params.warehouseId}`
      : Prisma.empty;

    // Total active products in the organization
    const totalProducts = await this.prisma.product.count({
      where: { organizationId, status: 'ACTIVE' },
    });

    // Aggregate stock data using raw SQL for efficiency
    const stockAgg = await this.prisma.$queryRaw<
      Array<{
        total_stock: string | null;
        total_value: string | null;
        products_with_stock: string;
        low_stock_count: string;
        out_of_stock_count: string;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(sb.quantity), 0)::text AS total_stock,
        COALESCE(SUM(sb.quantity * COALESCE(p."unitPrice", 0)), 0)::text AS total_value,
        COUNT(DISTINCT CASE WHEN sb.quantity > 0 THEN sb."productId" END)::text AS products_with_stock,
        COUNT(DISTINCT CASE WHEN sb.quantity > 0 AND sb.quantity <= ${LOW_STOCK_THRESHOLD} THEN sb."productId" END)::text AS low_stock_count,
        COUNT(DISTINCT CASE WHEN sb.quantity <= 0 THEN sb."productId" END)::text AS out_of_stock_count
      FROM "StockBalance" sb
      JOIN "Product" p ON p.id = sb."productId" AND p."organizationId" = sb."organizationId"
      WHERE sb."organizationId" = ${organizationId}
        AND p.status = 'ACTIVE'
        ${warehouseFilter}
    `);

    const row = stockAgg[0];

    // Compute real sales for today from SalesOrder
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const salesAgg = await this.prisma.salesOrder.aggregate({
      where: {
        organizationId,
        status: { not: 'CANCELLED' },
        orderDate: { gte: todayStart },
        ...(params?.warehouseId ? { warehouseId: params.warehouseId } : {}),
      },
      _sum: { grandTotal: true },
      _count: { id: true },
    });

    const todaysSales = salesAgg._sum.grandTotal ? salesAgg._sum.grandTotal.toFixed(2) : '0.00';
    const todaysOrdersCount = salesAgg._count.id ?? 0;

    return {
      totalProducts,
      totalStock: row?.total_stock ?? '0',
      lowStockCount: parseInt(row?.low_stock_count ?? '0', 10),
      outOfStockCount: parseInt(row?.out_of_stock_count ?? '0', 10),
      totalInventoryValue: row?.total_value ?? '0',
      todaysSales,
      todaysOrdersCount,
    };
  }

  /**
   * Sales Overview chart data: this week vs last week daily sales points.
   * All numbers are calculated from authoritative non-cancelled SalesOrder records.
   */
  async getSalesOverview(
    organizationId: string,
    params?: DashboardQueryParams,
  ): Promise<SalesOverviewPointDto[]> {
    const warehouseFilter = params?.warehouseId ? { warehouseId: params.warehouseId } : {};

    // Determine boundaries for current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday
    const distanceToMonday = (dayOfWeek + 6) % 7;

    const thisWeekStart = new Date(now);
    thisWeekStart.setUTCDate(now.getUTCDate() - distanceToMonday);
    thisWeekStart.setUTCHours(0, 0, 0, 0);

    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setUTCDate(thisWeekStart.getUTCDate() - 7);

    const lastWeekEnd = new Date(thisWeekStart);

    // Fetch non-cancelled orders for both weeks
    const [thisWeekOrders, lastWeekOrders] = await Promise.all([
      this.prisma.salesOrder.findMany({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
          orderDate: { gte: thisWeekStart },
          ...warehouseFilter,
        },
        select: { orderDate: true, grandTotal: true },
      }),
      this.prisma.salesOrder.findMany({
        where: {
          organizationId,
          status: { not: 'CANCELLED' },
          orderDate: { gte: lastWeekStart, lt: lastWeekEnd },
          ...warehouseFilter,
        },
        select: { orderDate: true, grandTotal: true },
      }),
    ]);

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const result: SalesOverviewPointDto[] = [];

    for (let i = 0; i < 7; i++) {
      const thisDayDate = new Date(thisWeekStart);
      thisDayDate.setUTCDate(thisWeekStart.getUTCDate() + i);
      const thisDayStr = thisDayDate.toISOString().split('T')[0]!;

      const lastDayDate = new Date(lastWeekStart);
      lastDayDate.setUTCDate(lastWeekStart.getUTCDate() + i);
      const lastDayStr = lastDayDate.toISOString().split('T')[0]!;

      const thisPeriodSum = thisWeekOrders
        .filter((o) => o.orderDate.toISOString().split('T')[0] === thisDayStr)
        .reduce((sum, o) => sum + parseFloat(o.grandTotal.toString()), 0);

      const lastPeriodSum = lastWeekOrders
        .filter((o) => o.orderDate.toISOString().split('T')[0] === lastDayStr)
        .reduce((sum, o) => sum + parseFloat(o.grandTotal.toString()), 0);

      result.push({
        day: dayNames[i]!,
        date: thisDayStr,
        thisPeriod: Math.round(thisPeriodSum * 100) / 100,
        lastPeriod: Math.round(lastPeriodSum * 100) / 100,
      });
    }

    return result;
  }

  /**
   * Top selling products by fulfilled/processed quantity.
   * Derived authoritatively from SalesOrderLine joined with SalesOrder and Product.
   */
  async getTopSellingProducts(
    organizationId: string,
    params?: DashboardQueryParams,
    limit = 5,
  ): Promise<TopSellingProductDto[]> {
    const warehouseFilter = params?.warehouseId
      ? Prisma.sql`AND so."warehouseId" = ${params.warehouseId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        sku: string;
        sold_qty: string;
        revenue: string;
      }>
    >(Prisma.sql`
      SELECT
        p.id,
        p.name,
        p.sku,
        COALESCE(SUM(sol.quantity), 0)::text AS sold_qty,
        COALESCE(SUM(sol."lineTotal"), 0)::text AS revenue
      FROM "SalesOrderLine" sol
      JOIN "SalesOrder" so ON so.id = sol."salesOrderId" AND so."organizationId" = sol."organizationId"
      JOIN "Product" p ON p.id = sol."productId" AND p."organizationId" = sol."organizationId"
      WHERE sol."organizationId" = ${organizationId}
        AND so.status != 'CANCELLED'
        ${warehouseFilter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY SUM(sol.quantity) DESC
      LIMIT ${limit}
    `);

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sku: r.sku,
      soldQty: Math.round(parseFloat(r.sold_qty)),
      revenue: parseFloat(r.revenue).toFixed(2),
    }));
  }

  /**
   * Inventory value grouped by category for donut chart.
   */
  async getInventoryByCategory(
    organizationId: string,
    params?: DashboardQueryParams,
  ): Promise<InventoryByCategoryDto[]> {
    const warehouseFilter = params?.warehouseId
      ? Prisma.sql`AND sb."warehouseId" = ${params.warehouseId}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        category_id: string;
        category_name: string;
        total_value: string;
        product_count: string;
      }>
    >(Prisma.sql`
      SELECT
        c.id AS category_id,
        c.name AS category_name,
        COALESCE(SUM(sb.quantity * COALESCE(p."unitPrice", 0)), 0)::text AS total_value,
        COUNT(DISTINCT p.id)::text AS product_count
      FROM "Category" c
      LEFT JOIN "Product" p ON p."categoryId" = c.id AND p."organizationId" = c."organizationId" AND p.status = 'ACTIVE'
      LEFT JOIN "StockBalance" sb ON sb."productId" = p.id AND sb."organizationId" = p."organizationId"
        ${warehouseFilter}
      WHERE c."organizationId" = ${organizationId}
      GROUP BY c.id, c.name
      HAVING COALESCE(SUM(sb.quantity * COALESCE(p."unitPrice", 0)), 0) > 0
      ORDER BY total_value DESC
    `);

    // Calculate total for percentages
    const totalValue = rows.reduce((sum, r) => sum + parseFloat(r.total_value), 0);

    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.category_name,
      totalValue: r.total_value,
      percentage:
        totalValue > 0 ? Math.round((parseFloat(r.total_value) / totalValue) * 1000) / 10 : 0,
      productCount: parseInt(r.product_count, 10),
    }));
  }

  /**
   * Stock status overview for donut chart: in stock, low stock, out of stock counts.
   */
  async getStockStatus(
    organizationId: string,
    params?: DashboardQueryParams,
  ): Promise<StockStatusOverviewDto> {
    const warehouseFilter = params?.warehouseId ? { warehouseId: params.warehouseId } : {};

    // Get all product IDs with stock balances
    const balances = await this.prisma.stockBalance.groupBy({
      by: ['productId'],
      where: {
        organizationId,
        ...warehouseFilter,
        product: { status: 'ACTIVE' },
      },
      _sum: { quantity: true },
    });

    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;

    for (const b of balances) {
      const qty = b._sum.quantity ? parseFloat(b._sum.quantity.toString()) : 0;
      if (qty <= 0) {
        outOfStock++;
      } else if (qty <= LOW_STOCK_THRESHOLD) {
        lowStock++;
      } else {
        inStock++;
      }
    }

    // Count products with no stock balance at all as out of stock
    const totalActiveProducts = await this.prisma.product.count({
      where: { organizationId, status: 'ACTIVE' },
    });
    const productsWithBalance = balances.length;
    const productsWithNoBalance = totalActiveProducts - productsWithBalance;
    outOfStock += productsWithNoBalance;

    return {
      inStock,
      lowStock,
      outOfStock,
      totalProducts: totalActiveProducts,
    };
  }

  /**
   * Recent audit activities enriched with descriptions.
   */
  async getRecentActivities(organizationId: string, limit = 10): Promise<RecentActivityDto[]> {
    const events = await this.prisma.auditEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        actorUserId: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Batch-fetch actor emails
    const actorIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean))] as string[];
    const actors =
      actorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, email: true },
          })
        : [];
    const actorMap = new Map(actors.map((a) => [a.id, a.email]));

    return events.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      description: this.describeAction(
        e.action,
        e.entityType,
        e.metadata as Record<string, unknown> | null,
      ),
      timestamp: e.createdAt.toISOString(),
      actorEmail: e.actorUserId ? (actorMap.get(e.actorUserId) ?? null) : null,
    }));
  }

  private describeAction(
    action: string,
    entityType: string,
    metadata: Record<string, unknown> | null,
  ): string {
    const name = (metadata?.name as string) || (metadata?.sku as string) || '';
    const nameStr = name ? ` "${name}"` : '';

    switch (action) {
      case 'product.created':
        return `New product${nameStr} was created`;
      case 'product.updated':
        return `Product${nameStr} was updated`;
      case 'product.deleted':
        return `Product${nameStr} was deleted`;
      case 'warehouse.created':
        return `New warehouse${nameStr} was created`;
      case 'warehouse.updated':
        return `Warehouse${nameStr} was updated`;
      case 'warehouse.deleted':
        return `Warehouse${nameStr} was deleted`;
      case 'stock.mutated':
        return `Stock ${(metadata?.type as string)?.toLowerCase() || 'mutation'} performed`;
      case 'purchase-order.created':
        return `Purchase Order #${(metadata?.purchaseOrderNumber as string) || ''} created`;
      case 'purchase-order.submitted':
        return `Purchase Order #${(metadata?.purchaseOrderNumber as string) || ''} submitted`;
      case 'purchase-order.approved':
        return `Purchase Order #${(metadata?.purchaseOrderNumber as string) || ''} approved`;
      case 'purchase-order.received':
        return `Goods received for PO #${(metadata?.purchaseOrderNumber as string) || ''}`;
      case 'stock-transfer.created':
        return `Stock transfer #${(metadata?.transferNumber as string) || ''} created`;
      case 'stock-transfer.approved':
        return `Stock transfer #${(metadata?.transferNumber as string) || ''} approved`;
      case 'stock-transfer.shipped':
        return `Stock transfer #${(metadata?.transferNumber as string) || ''} shipped`;
      case 'stock-transfer.received':
        return `Stock transfer #${(metadata?.transferNumber as string) || ''} received`;
      case 'sales-order.created':
        return `Sales Order #${(metadata?.salesOrderNumber as string) || ''} created`;
      case 'sales-order.submitted':
        return `Sales Order #${(metadata?.salesOrderNumber as string) || ''} submitted`;
      case 'sales-order.approved':
        return `Sales Order #${(metadata?.salesOrderNumber as string) || ''} approved`;
      case 'sales-order.fulfilled':
        return `Sales Order #${(metadata?.salesOrderNumber as string) || ''} fulfilled`;
      case 'sales-order.cancelled':
        return `Sales Order #${(metadata?.salesOrderNumber as string) || ''} cancelled`;
      case 'category.created':
        return `New category${nameStr} was created`;
      default:
        return `${entityType} ${action.split('.').pop() || action}`;
    }
  }
}
