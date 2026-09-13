import { BadRequestException } from '@nestjs/common';
import { QuantityUtil } from '../core/utils/quantity.util';
import { StockQuantityValidator } from '../stock/stock.quantity';
import {
  StockTransferInvalidLineException,
  StockTransferSameWarehouseException,
} from './transfers.errors';
import {
  ValidatedCreateTransferInput,
  ValidatedTransferLine,
  ValidatedUpdateTransferInput,
} from './transfers.types';

export class StockTransferValidator {
  public static readonly MAX_TRANSFER_NUMBER_LENGTH = 50;
  public static readonly TRANSFER_NUMBER_REGEX = /^[A-Za-z0-9_-]+$/;

  /**
   * Validates that source and destination warehouses are different.
   */
  static validateWarehouses(sourceWarehouseId: string, destinationWarehouseId: string): void {
    if (!sourceWarehouseId || !destinationWarehouseId) {
      throw new BadRequestException('Both source and destination warehouse IDs are required');
    }
    if (sourceWarehouseId === destinationWarehouseId) {
      throw new StockTransferSameWarehouseException(
        'Source and destination warehouses cannot be the same warehouse',
      );
    }
  }

  /**
   * Validates transfer number format and length.
   */
  static validateTransferNumber(transferNumber: string): string {
    if (typeof transferNumber !== 'string') {
      throw new BadRequestException('Transfer number must be a string');
    }
    const trimmed = transferNumber.trim();
    if (!trimmed) {
      throw new BadRequestException('Transfer number cannot be empty');
    }
    if (trimmed.length > this.MAX_TRANSFER_NUMBER_LENGTH) {
      throw new BadRequestException(
        `Transfer number exceeds maximum length of ${this.MAX_TRANSFER_NUMBER_LENGTH} characters`,
      );
    }
    if (!this.TRANSFER_NUMBER_REGEX.test(trimmed)) {
      throw new BadRequestException(
        'Transfer number can only contain letters, numbers, hyphens, and underscores',
      );
    }
    return trimmed;
  }

  /**
   * Validates line items: non-empty, unique products, exact decimal quantities > 0.
   */
  static validateLines(
    lines: Array<{ productId: string; quantity: string; notes?: string | null }>,
  ): ValidatedTransferLine[] {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new StockTransferInvalidLineException(
        'Stock transfer must contain at least one line item',
      );
    }

    const seenProducts = new Set<string>();
    const validatedLines: ValidatedTransferLine[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) {
        throw new StockTransferInvalidLineException(`Line at index ${i} is undefined`);
      }

      const { productId, quantity, notes } = line;

      if (!productId || typeof productId !== 'string' || !productId.trim()) {
        throw new StockTransferInvalidLineException(`Line at index ${i} has an invalid product ID`);
      }

      const trimmedProductId = productId.trim();
      if (seenProducts.has(trimmedProductId)) {
        throw new StockTransferInvalidLineException(
          `Duplicate product "${trimmedProductId}" detected. Each product can only appear once in a transfer.`,
        );
      }
      seenProducts.add(trimmedProductId);

      // Validate exact decimal quantity > 0 with at most 4 decimal places
      const normalizedQuantity = StockQuantityValidator.validatePrecision(quantity);
      if (!QuantityUtil.isPositive(normalizedQuantity, StockQuantityValidator.MAX_SCALE)) {
        throw new StockTransferInvalidLineException(
          `Line at index ${i} must have a quantity strictly greater than 0; received "${quantity}"`,
        );
      }

      validatedLines.push({
        productId: trimmedProductId,
        quantity: normalizedQuantity,
        notes: notes?.trim() || null,
      });
    }

    return validatedLines;
  }

  /**
   * Validates complete input for creating a StockTransfer.
   */
  static validateCreate(input: {
    transferNumber: string;
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    notes?: string | null;
    lines: Array<{ productId: string; quantity: string; notes?: string | null }>;
  }): ValidatedCreateTransferInput {
    this.validateWarehouses(input.sourceWarehouseId, input.destinationWarehouseId);
    const transferNumber = this.validateTransferNumber(input.transferNumber);
    const lines = this.validateLines(input.lines);

    return {
      transferNumber,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      notes: input.notes?.trim() || null,
      lines,
    };
  }

  /**
   * Validates input for updating a DRAFT StockTransfer.
   */
  static validateUpdate(
    currentSourceId: string,
    currentDestId: string,
    input: {
      sourceWarehouseId?: string;
      destinationWarehouseId?: string;
      notes?: string | null;
      lines?: Array<{ productId: string; quantity: string; notes?: string | null }>;
    },
  ): ValidatedUpdateTransferInput {
    const effectiveSource = input.sourceWarehouseId ?? currentSourceId;
    const effectiveDest = input.destinationWarehouseId ?? currentDestId;
    this.validateWarehouses(effectiveSource, effectiveDest);

    const validated: ValidatedUpdateTransferInput = {};
    if (input.sourceWarehouseId) validated.sourceWarehouseId = input.sourceWarehouseId;
    if (input.destinationWarehouseId)
      validated.destinationWarehouseId = input.destinationWarehouseId;
    if (input.notes !== undefined) validated.notes = input.notes?.trim() || null;
    if (input.lines) {
      validated.lines = this.validateLines(input.lines);
    }

    return validated;
  }
}
