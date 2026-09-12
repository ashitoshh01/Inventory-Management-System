import { StockLedgerEntryType } from '@repo/types';
import { Prisma } from '@repo/database';
import { QuantityUtil } from '../core/utils/quantity.util';
import { StockInvalidQuantityException, StockInsufficientQuantityException } from './stock.errors';

/**
 * StockQuantityValidator
 * Enforces the domain invariant of exact 4-decimal precision (PostgreSQL DECIMAL(14, 4)),
 * mathematical consistency across immutable ledger entries, and non-zero mutation deltas.
 */
export class StockQuantityValidator {
  public static readonly MAX_SCALE = 4;

  /**
   * Converts any supported quantity representation to a raw string without scientific notation.
   */
  public static toRawString(value: string | number | Prisma.Decimal): string {
    if (value instanceof Prisma.Decimal) {
      return value.toFixed(StockQuantityValidator.MAX_SCALE);
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw new StockInvalidQuantityException(`Invalid quantity number: "${value}"`);
      }
      return value.toString();
    }
    const trimmed = value.trim();
    if (!trimmed || isNaN(Number(trimmed))) {
      throw new StockInvalidQuantityException(`Invalid quantity string: "${value}"`);
    }
    return trimmed;
  }

  /**
   * Validates that the quantity does not exceed 4 decimal places of scale.
   * Values like "0.0001" or "1.25" pass.
   * Values like "0.00001" or "1.12345" throw StockInvalidQuantityException.
   */
  public static validatePrecision(value: string | number | Prisma.Decimal): string {
    const raw = this.toRawString(value);
    const clean = raw.startsWith('-') ? raw.slice(1) : raw;
    const parts = clean.split('.');

    if (parts.length === 2 && parts[1] !== undefined) {
      const fractionalPart = parts[1];
      // If there are more than 4 digits in fractional part, check if any digit beyond index 3 is non-zero
      if (fractionalPart.length > StockQuantityValidator.MAX_SCALE) {
        const excessDigits = fractionalPart.slice(StockQuantityValidator.MAX_SCALE);
        if (/[1-9]/.test(excessDigits)) {
          throw new StockInvalidQuantityException(
            `Quantity precision exceeds maximum allowed ${StockQuantityValidator.MAX_SCALE} decimal places: "${raw}"`,
          );
        }
      }
    }

    return QuantityUtil.normalize(raw);
  }

  /**
   * Validates that a ledger entry delta is strictly non-zero.
   */
  public static validateNonZeroDelta(delta: string | number | Prisma.Decimal): void {
    const normalized = this.validatePrecision(delta);
    if (QuantityUtil.isZero(normalized)) {
      throw new StockInvalidQuantityException('Stock ledger entry quantity delta cannot be zero');
    }
  }

  /**
   * Validates that quantityAfter mathematically equals quantityBefore + quantityDelta.
   */
  public static validateLedgerMath(
    quantityBefore: string | number | Prisma.Decimal,
    quantityDelta: string | number | Prisma.Decimal,
    quantityAfter: string | number | Prisma.Decimal,
  ): void {
    const normBefore = this.validatePrecision(quantityBefore);
    const normDelta = this.validatePrecision(quantityDelta);
    const normAfter = this.validatePrecision(quantityAfter);

    this.validateNonZeroDelta(quantityDelta);

    const calculatedAfter = QuantityUtil.add(normBefore, normDelta);
    if (QuantityUtil.compare(calculatedAfter, normAfter) !== 0) {
      throw new StockInvalidQuantityException(
        `Ledger math inconsistency: quantityBefore (${normBefore}) + quantityDelta (${normDelta}) = ${calculatedAfter}, but quantityAfter is ${normAfter}`,
      );
    }
  }

  /**
   * Validates that the delta adheres to the specific semantic rules of the mutation type.
   */
  public static validateMutationDelta(
    type: StockLedgerEntryType,
    delta: string | number | Prisma.Decimal,
  ): string {
    const normDelta = this.validatePrecision(delta);

    switch (type) {
      case 'OPENING':
        if (!QuantityUtil.isPositive(normDelta)) {
          throw new StockInvalidQuantityException('Opening stock delta must be strictly positive');
        }
        break;
      case 'RECEIPT':
        if (!QuantityUtil.isPositive(normDelta)) {
          throw new StockInvalidQuantityException('Receipt stock delta must be strictly positive');
        }
        break;
      case 'ISSUE':
        if (!normDelta.startsWith('-') || QuantityUtil.isZero(normDelta)) {
          throw new StockInvalidQuantityException('Issue stock delta must be strictly negative');
        }
        break;
      case 'ADJUSTMENT':
        if (QuantityUtil.isZero(normDelta)) {
          throw new StockInvalidQuantityException('Adjustment stock delta cannot be zero');
        }
        break;
      default:
        throw new StockInvalidQuantityException(`Unsupported stock mutation type: ${String(type)}`);
    }

    return normDelta;
  }

  /**
   * Calculates new quantity given current balance and delta using exact fixed-point arithmetic.
   */
  public static calculateNewQuantity(
    currentQuantity: string | number | Prisma.Decimal,
    delta: string | number | Prisma.Decimal,
  ): string {
    const normCurrent = this.validatePrecision(currentQuantity);
    const normDelta = this.validatePrecision(delta);
    return QuantityUtil.add(normCurrent, normDelta);
  }

  /**
   * Asserts that resulting stock balance is non-negative.
   * Throws StockInsufficientQuantityException if negative.
   */
  public static assertNonNegative(quantity: string | number | Prisma.Decimal): void {
    const norm = this.validatePrecision(quantity);
    if (norm.startsWith('-') && !QuantityUtil.isZero(norm)) {
      throw new StockInsufficientQuantityException(
        `Insufficient stock for mutation; resulting quantity (${norm}) would be negative`,
      );
    }
  }
}
