import { Prisma } from '@repo/database';
import { QuantityUtil } from '../core/utils/quantity.util';
import { PurchaseOrderInvalidLineException } from './purchase-orders.errors';
import {
  InternalCreatePurchaseOrder,
  InternalCreatePurchaseOrderLine,
  PurchaseOrderTotalsCalculation,
} from './purchase-orders.types';
import { BadRequestException } from '@nestjs/common';

export class PurchaseOrderValidator {
  public static readonly MAX_PO_NUMBER_LENGTH = 50;
  public static readonly MAX_SUPPLIER_NAME_LENGTH = 255;
  public static readonly MAX_NOTES_LENGTH = 2000;
  public static readonly PO_NUMBER_REGEX = /^[A-Za-z0-9_-]+$/;

  /**
   * Validates and normalizes a purchase order number.
   */
  static validateOrderNumber(raw: string): string {
    if (typeof raw !== 'string') {
      throw new BadRequestException('Purchase order number must be a string');
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new BadRequestException('Purchase order number cannot be empty');
    }
    if (trimmed.length > this.MAX_PO_NUMBER_LENGTH) {
      throw new BadRequestException(
        `Purchase order number exceeds maximum length of ${this.MAX_PO_NUMBER_LENGTH} characters`,
      );
    }
    if (!this.PO_NUMBER_REGEX.test(trimmed)) {
      throw new BadRequestException(
        'Purchase order number can only contain letters, numbers, hyphens, and underscores',
      );
    }
    return trimmed;
  }

  /**
   * Validates supplier name and email.
   */
  static validateSupplier(
    name: string,
    email?: string | null,
  ): { name: string; email?: string | null } {
    if (typeof name !== 'string') {
      throw new BadRequestException('Supplier name must be a string');
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Supplier name cannot be empty');
    }
    if (trimmedName.length > this.MAX_SUPPLIER_NAME_LENGTH) {
      throw new BadRequestException(
        `Supplier name exceeds maximum length of ${this.MAX_SUPPLIER_NAME_LENGTH} characters`,
      );
    }

    let trimmedEmail: string | null = null;
    if (email !== undefined && email !== null) {
      const em = email.trim();
      if (em.length > 0) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(em)) {
          throw new BadRequestException(`Invalid supplier email address: "${em}"`);
        }
        trimmedEmail = em.toLowerCase();
      }
    }

    return { name: trimmedName, email: trimmedEmail };
  }

  /**
   * Validates order dates.
   */
  static validateDates(
    orderDateInput?: Date | string,
    expectedDateInput?: Date | string | null,
  ): { orderDate: Date; expectedDate: Date | null } {
    const orderDate = orderDateInput ? new Date(orderDateInput) : new Date();
    if (isNaN(orderDate.getTime())) {
      throw new BadRequestException('Invalid orderDate format');
    }

    let expectedDate: Date | null = null;
    if (expectedDateInput !== undefined && expectedDateInput !== null) {
      expectedDate = new Date(expectedDateInput);
      if (isNaN(expectedDate.getTime())) {
        throw new BadRequestException('Invalid expectedDate format');
      }
      if (expectedDate < orderDate) {
        throw new BadRequestException('expectedDate cannot precede orderDate');
      }
    }

    return { orderDate, expectedDate };
  }

  /**
   * Validates a 4-decimal quantity string:
   * - Must be valid numeric representation
   * - Max 4 decimal places
   * - Must be strictly positive (> 0)
   */
  static validateQuantity(raw: string | number): string {
    const str = typeof raw === 'number' ? raw.toString() : (raw ?? '').toString().trim();
    if (!str || isNaN(Number(str))) {
      throw new PurchaseOrderInvalidLineException(`Invalid line quantity: "${raw}"`);
    }

    // Validate precision does not exceed 4 decimal places
    const clean = str.startsWith('-') ? str.slice(1) : str;
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1] !== undefined) {
      if (parts[1].length > 4) {
        const excess = parts[1].slice(4);
        if (/[1-9]/.test(excess)) {
          throw new PurchaseOrderInvalidLineException(
            `Line quantity exceeds maximum allowed 4 decimal places: "${str}"`,
          );
        }
      }
    }

    const normalized = QuantityUtil.normalize(str, 4);
    if (!QuantityUtil.isPositive(normalized, 4)) {
      throw new PurchaseOrderInvalidLineException(
        `Line quantity must be strictly greater than zero: "${str}"`,
      );
    }

    return normalized;
  }

  /**
   * Validates a 4-decimal unit price:
   * - Must be valid numeric representation
   * - Max 4 decimal places
   * - Must be non-negative (>= 0)
   */
  static validateUnitPrice(raw: string | number): string {
    const str = typeof raw === 'number' ? raw.toString() : (raw ?? '').toString().trim();
    if (!str || isNaN(Number(str))) {
      throw new PurchaseOrderInvalidLineException(`Invalid unit price: "${raw}"`);
    }

    const clean = str.startsWith('-') ? str.slice(1) : str;
    const parts = clean.split('.');
    if (parts.length === 2 && parts[1] !== undefined) {
      if (parts[1].length > 4) {
        const excess = parts[1].slice(4);
        if (/[1-9]/.test(excess)) {
          throw new PurchaseOrderInvalidLineException(
            `Unit price exceeds maximum allowed 4 decimal places: "${str}"`,
          );
        }
      }
    }

    const normalized = QuantityUtil.normalize(str, 4);
    if (normalized.startsWith('-') && !QuantityUtil.isZero(normalized, 4)) {
      throw new PurchaseOrderInvalidLineException(`Unit price cannot be negative: "${str}"`);
    }

    return normalized;
  }

  /**
   * Validates lines and calculates authoritative totals using exact Prisma.Decimal arithmetic.
   */
  static validateAndCalculateTotals(
    lines: InternalCreatePurchaseOrderLine[],
  ): PurchaseOrderTotalsCalculation {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new PurchaseOrderInvalidLineException(
        'Purchase order must contain at least one line item',
      );
    }

    const seenProducts = new Set<string>();
    const calculatedLines = lines.map((line, index) => {
      if (!line.productId || typeof line.productId !== 'string' || !line.productId.trim()) {
        throw new PurchaseOrderInvalidLineException(
          `Line at index ${index} missing required productId`,
        );
      }
      const productId = line.productId.trim();
      if (seenProducts.has(productId)) {
        throw new PurchaseOrderInvalidLineException(
          `Duplicate product "${productId}" found in line items. Each product should appear only once per purchase order.`,
        );
      }
      seenProducts.add(productId);

      const quantity = this.validateQuantity(line.quantity);
      const unitPrice = this.validateUnitPrice(line.unitPrice);

      // Exact Decimal arithmetic for line total: quantity * unitPrice
      const qDec = new Prisma.Decimal(quantity);
      const pDec = new Prisma.Decimal(unitPrice);
      const lineTotalDec = qDec.mul(pDec);
      const lineTotal = lineTotalDec.toFixed(4);

      return {
        productId,
        quantity,
        unitPrice,
        lineTotal,
        notes: line.notes ? line.notes.trim().slice(0, this.MAX_NOTES_LENGTH) : null,
      };
    });

    // Authoritative subtotal = sum(lineTotal)
    let subtotalDec = new Prisma.Decimal(0);
    for (const l of calculatedLines) {
      subtotalDec = subtotalDec.add(new Prisma.Decimal(l.lineTotal));
    }

    const subtotal = subtotalDec.toFixed(4);
    const taxTotal = '0.0000'; // No speculative tax engine in Phase 6A
    const grandTotal = subtotal;

    return {
      lines: calculatedLines,
      subtotal,
      taxTotal,
      grandTotal,
    };
  }

  /**
   * Comprehensive validation for entire Purchase Order creation input.
   */
  static validateCreateInput(input: InternalCreatePurchaseOrder): {
    purchaseOrderNumber: string;
    supplierName: string;
    supplierEmail?: string | null | undefined;
    warehouseId: string;
    orderDate: Date;
    expectedDate: Date | null;
    currency: string;
    notes?: string | null | undefined;
    calculated: PurchaseOrderTotalsCalculation;
  } {
    const purchaseOrderNumber = this.validateOrderNumber(input.purchaseOrderNumber);
    const { name: supplierName, email: supplierEmail } = this.validateSupplier(
      input.supplierName,
      input.supplierEmail,
    );

    if (!input.warehouseId || typeof input.warehouseId !== 'string' || !input.warehouseId.trim()) {
      throw new BadRequestException('warehouseId is required');
    }
    const warehouseId = input.warehouseId.trim();

    const { orderDate, expectedDate } = this.validateDates(input.orderDate, input.expectedDate);

    const currency = (input.currency?.trim() || 'INR').toUpperCase();
    if (currency.length !== 3) {
      throw new BadRequestException('Currency must be a 3-character ISO code (e.g., INR, USD)');
    }

    const notes = input.notes ? input.notes.trim().slice(0, this.MAX_NOTES_LENGTH) : null;
    const calculated = this.validateAndCalculateTotals(input.lines);

    return {
      purchaseOrderNumber,
      supplierName,
      supplierEmail,
      warehouseId,
      orderDate,
      expectedDate,
      currency,
      notes,
      calculated,
    };
  }
}
