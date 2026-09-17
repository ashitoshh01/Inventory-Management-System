import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PrismaService, Prisma } from '@repo/database';
import { AdminInventoryQueryDto, AdminPaginationDto } from './dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminInventoryController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('products')
  async listProducts(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ProductWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, products] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      items: products,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('categories')
  async listCategories(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CategoryWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where }),
      this.prisma.category.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { name: 'asc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: { select: { products: true } },
        },
      }),
    ]);

    return {
      items: categories,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('warehouses')
  async listWarehouses(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.WarehouseWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    const [total, warehouses] = await Promise.all([
      this.prisma.warehouse.count({ where }),
      this.prisma.warehouse.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: { select: { stockBalances: true } },
        },
      }),
    ]);

    return {
      items: warehouses,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('stock')
  async listStock(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StockBalanceWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, stock] = await Promise.all([
      this.prisma.stockBalance.count({ where }),
      this.prisma.stockBalance.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    return {
      items: stock,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('stock/ledger')
  async listStockLedger(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StockLedgerEntryWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.product = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { sku: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, entries] = await Promise.all([
      this.prisma.stockLedgerEntry.count({ where }),
      this.prisma.stockLedgerEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          warehouse: { select: { id: true, name: true } },
          organization: { select: { id: true, name: true, slug: true } },
          creator: { select: { id: true, email: true } },
        },
      }),
    ]);

    return {
      items: entries,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('purchase-orders')
  async listPurchaseOrders(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.PurchaseOrderWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.status) {
      where.status = query.status as Prisma.EnumPurchaseOrderStatusFilter;
    }
    if (query.search) {
      where.OR = [
        { purchaseOrderNumber: { contains: query.search, mode: 'insensitive' } },
        { supplierName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          warehouse: { select: { id: true, name: true } },
          creator: { select: { id: true, email: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    return {
      items: orders,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('transfers')
  async listTransfers(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.StockTransferWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.status) {
      where.status = query.status as Prisma.EnumStockTransferStatusFilter;
    }
    if (query.search) {
      where.transferNumber = { contains: query.search, mode: 'insensitive' };
    }

    const [total, transfers] = await Promise.all([
      this.prisma.stockTransfer.count({ where }),
      this.prisma.stockTransfer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          sourceWarehouse: { select: { id: true, name: true } },
          destinationWarehouse: { select: { id: true, name: true } },
          creator: { select: { id: true, email: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    return {
      items: transfers,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('sales-orders')
  async listSalesOrders(@Query() query: AdminInventoryQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.SalesOrderWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.status) {
      where.status = query.status as Prisma.EnumSalesOrderStatusFilter;
    }
    if (query.search) {
      where.OR = [
        { salesOrderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          warehouse: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, email: true } },
          _count: { select: { lines: true } },
        },
      }),
    ]);

    return {
      items: orders,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('customers')
  async listCustomers(@Query() query: AdminPaginationDto & { organizationId?: string }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CustomerWhereInput = {};
    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { id: true, name: true, slug: true } },
          _count: { select: { salesOrders: true } },
        },
      }),
    ]);

    return {
      items: customers,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
