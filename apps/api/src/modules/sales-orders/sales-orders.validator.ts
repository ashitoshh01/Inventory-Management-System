import { Prisma, PrismaService } from '@repo/database';
import { CreateSalesOrderDto, UpdateSalesOrderDto } from './dto/sales-order.dto';
import { ValidatedSalesOrderData, ValidatedSalesOrderLineItem } from './sales-orders.types';
import {
  SalesOrderCustomerNotFoundException,
  SalesOrderLineValidationException,
  SalesOrderProductNotFoundException,
  SalesOrderWarehouseNotFoundException,
} from './sales-orders.errors';

export class SalesOrdersValidator {
  /**
   * Validates creation input against database records and computes authoritative financial totals.
   */
  static async validateCreate(
    prisma: PrismaService,
    organizationId: string,
    dto: CreateSalesOrderDto,
  ): Promise<ValidatedSalesOrderData> {
    // 1. Verify warehouse exists in tenant
    const warehouse = await prisma.warehouse.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new SalesOrderWarehouseNotFoundException(dto.warehouseId);
    }
    if (warehouse.status !== 'ACTIVE') {
      throw new SalesOrderLineValidationException(
        `Warehouse '${warehouse.name}' is inactive and cannot be used for sales orders`,
      );
    }

    // 2. Verify customer if provided
    let customerName = dto.customerName?.trim();
    let customerEmail = dto.customerEmail?.trim() || null;
    if (dto.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId },
      });
      if (!customer) {
        throw new SalesOrderCustomerNotFoundException(dto.customerId);
      }
      if (customer.status !== 'ACTIVE') {
        throw new SalesOrderLineValidationException(
          `Customer '${customer.name}' is inactive and cannot be assigned to sales orders`,
        );
      }
      if (!customerName) {
        customerName = customer.name;
      }
      if (!customerEmail && customer.email) {
        customerEmail = customer.email;
      }
    }

    if (!customerName) {
      throw new SalesOrderLineValidationException('Customer name is required');
    }

    // 3. Verify lines and unique products
    if (!dto.lines || dto.lines.length === 0) {
      throw new SalesOrderLineValidationException('Sales order must contain at least one line item');
    }

    const seenProducts = new Set<string>();
    for (const line of dto.lines) {
      if (seenProducts.has(line.productId)) {
        throw new SalesOrderLineValidationException(
          `Duplicate product '${line.productId}' detected in order lines. Each product may only appear once per order.`,
        );
      }
      seenProducts.add(line.productId);
    }

    // 4. Verify all products exist in tenant and are active
    const productIds = Array.from(seenProducts);
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        organizationId,
      },
      select: { id: true, name: true, status: true },
    });

    const productMap = new Map(existingProducts.map((p) => [p.id, p]));
    for (const pid of productIds) {
      const product = productMap.get(pid);
      if (!product) {
        throw new SalesOrderProductNotFoundException(pid);
      }
      if (product.status !== 'ACTIVE') {
        throw new SalesOrderLineValidationException(
          `Product '${product.name}' is inactive and cannot be added to sales orders`,
        );
      }
    }

    // 5. Authoritative calculation of line totals and grand total
    let subtotalDecimal = new Prisma.Decimal(0);
    const validatedLines: ValidatedSalesOrderLineItem[] = [];

    for (const line of dto.lines) {
      const qtyDecimal = new Prisma.Decimal(line.quantity.trim());
      const priceDecimal = new Prisma.Decimal(line.unitPrice.trim());
      const lineTotalDecimal = qtyDecimal.mul(priceDecimal);

      subtotalDecimal = subtotalDecimal.add(lineTotalDecimal);

      validatedLines.push({
        productId: line.productId,
        quantity: qtyDecimal.toFixed(4),
        unitPrice: priceDecimal.toFixed(4),
        lineTotal: lineTotalDecimal.toFixed(4),
        notes: line.notes?.trim() || null,
      });
    }

    const taxTotalDecimal = new Prisma.Decimal(0); // Default 0
    const grandTotalDecimal = subtotalDecimal.add(taxTotalDecimal);

    return {
      salesOrderNumber: dto.salesOrderNumber.trim(),
      customerId: dto.customerId || null,
      customerName,
      customerEmail,
      warehouseId: dto.warehouseId,
      currency: dto.currency?.trim() || 'INR',
      subtotal: subtotalDecimal.toFixed(4),
      taxTotal: taxTotalDecimal.toFixed(4),
      grandTotal: grandTotalDecimal.toFixed(4),
      notes: dto.notes?.trim() || null,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
      lines: validatedLines,
    };
  }

  /**
   * Validates partial update input against existing order and catalog records.
   */
  static async validateUpdate(
    prisma: PrismaService,
    organizationId: string,
    existingWarehouseId: string,
    dto: UpdateSalesOrderDto,
  ): Promise<Partial<ValidatedSalesOrderData>> {
    const result: Partial<ValidatedSalesOrderData> = {};

    if (dto.warehouseId) {
      const warehouse = await prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, organizationId },
      });
      if (!warehouse) {
        throw new SalesOrderWarehouseNotFoundException(dto.warehouseId);
      }
      if (warehouse.status !== 'ACTIVE') {
        throw new SalesOrderLineValidationException(
          `Warehouse '${warehouse.name}' is inactive and cannot be used for sales orders`,
        );
      }
      result.warehouseId = dto.warehouseId;
    }

    if (dto.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId },
      });
      if (!customer) {
        throw new SalesOrderCustomerNotFoundException(dto.customerId);
      }
      if (customer.status !== 'ACTIVE') {
        throw new SalesOrderLineValidationException(
          `Customer '${customer.name}' is inactive and cannot be assigned to sales orders`,
        );
      }
      result.customerId = dto.customerId;
      if (!dto.customerName) {
        result.customerName = customer.name;
      }
      if (!dto.customerEmail && customer.email) {
        result.customerEmail = customer.email;
      }
    }

    if (dto.customerName !== undefined) {
      result.customerName = dto.customerName.trim();
    }
    if (dto.customerEmail !== undefined) {
      result.customerEmail = dto.customerEmail ? dto.customerEmail.trim() : null;
    }
    if (dto.currency !== undefined) {
      result.currency = dto.currency.trim();
    }
    if (dto.notes !== undefined) {
      result.notes = dto.notes ? dto.notes.trim() : null;
    }
    if (dto.orderDate !== undefined) {
      result.orderDate = new Date(dto.orderDate);
    }
    if (dto.expectedDate !== undefined) {
      result.expectedDate = dto.expectedDate ? new Date(dto.expectedDate) : null;
    }

    if (dto.lines) {
      if (dto.lines.length === 0) {
        throw new SalesOrderLineValidationException(
          'Sales order must contain at least one line item',
        );
      }

      const seenProducts = new Set<string>();
      for (const line of dto.lines) {
        if (seenProducts.has(line.productId)) {
          throw new SalesOrderLineValidationException(
            `Duplicate product '${line.productId}' detected in order lines`,
          );
        }
        seenProducts.add(line.productId);
      }

      const productIds = Array.from(seenProducts);
      const existingProducts = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          organizationId,
        },
        select: { id: true, name: true, status: true },
      });

      const productMap = new Map(existingProducts.map((p) => [p.id, p]));
      for (const pid of productIds) {
        const product = productMap.get(pid);
        if (!product) {
          throw new SalesOrderProductNotFoundException(pid);
        }
        if (product.status !== 'ACTIVE') {
          throw new SalesOrderLineValidationException(
            `Product '${product.name}' is inactive and cannot be added to sales orders`,
          );
        }
      }

      let subtotalDecimal = new Prisma.Decimal(0);
      const validatedLines: ValidatedSalesOrderLineItem[] = [];

      for (const line of dto.lines) {
        const qtyDecimal = new Prisma.Decimal(line.quantity.trim());
        const priceDecimal = new Prisma.Decimal(line.unitPrice.trim());
        const lineTotalDecimal = qtyDecimal.mul(priceDecimal);

        subtotalDecimal = subtotalDecimal.add(lineTotalDecimal);

        validatedLines.push({
          productId: line.productId,
          quantity: qtyDecimal.toFixed(4),
          unitPrice: priceDecimal.toFixed(4),
          lineTotal: lineTotalDecimal.toFixed(4),
          notes: line.notes?.trim() || null,
        });
      }

      const taxTotalDecimal = new Prisma.Decimal(0);
      const grandTotalDecimal = subtotalDecimal.add(taxTotalDecimal);

      result.lines = validatedLines;
      result.subtotal = subtotalDecimal.toFixed(4);
      result.taxTotal = taxTotalDecimal.toFixed(4);
      result.grandTotal = grandTotalDecimal.toFixed(4);
    }

    return result;
  }
}
