/**
 * Quantity Utility
 * Supports fractional inventory quantities (e.g. 1.5 kg, 0.250 L) up to 4 decimal places
 * avoiding JavaScript floating-point representation and precision drift.
 */
export class QuantityUtil {
  public static readonly DEFAULT_PRECISION = 4;

  /**
   * Converts a quantity into a scaled integer (e.g., 1.5000 with precision 4 -> 15000n).
   */
  static toScaledInteger(quantity: number | string, precision = QuantityUtil.DEFAULT_PRECISION): bigint {
    const raw = typeof quantity === 'number' ? quantity.toString() : quantity.trim();
    if (!raw || isNaN(Number(raw))) {
      throw new Error(`Invalid quantity value: "${quantity}"`);
    }

    const isNegative = raw.startsWith('-');
    const clean = isNegative ? raw.slice(1) : raw;
    const [wholePart, fractionalPart = ''] = clean.split('.');

    const paddedFraction = (fractionalPart + '0'.repeat(precision)).slice(0, precision);
    const combined = `${wholePart}${paddedFraction}`;

    const value = BigInt(combined);
    return isNegative ? -value : value;
  }

  /**
   * Converts a scaled integer back into a standardized 4-decimal string.
   */
  static fromScaledInteger(scaled: bigint | number | string, precision = QuantityUtil.DEFAULT_PRECISION): string {
    const raw = BigInt(scaled).toString();
    const isNegative = raw.startsWith('-');
    const digits = isNegative ? raw.slice(1) : raw;

    if (digits.length <= precision) {
      const padded = digits.padStart(precision, '0');
      const formatted = `0.${padded}`;
      return isNegative ? `-${formatted}` : formatted;
    }

    const splitIdx = digits.length - precision;
    const whole = digits.slice(0, splitIdx);
    const fraction = digits.slice(splitIdx);
    const formatted = `${whole}.${fraction}`;
    return isNegative ? `-${formatted}` : formatted;
  }

  /**
   * Normalizes a quantity to a standardized decimal string (e.g. 1.5 -> "1.5000").
   */
  static normalize(quantity: number | string, precision = QuantityUtil.DEFAULT_PRECISION): string {
    const scaled = this.toScaledInteger(quantity, precision);
    return this.fromScaledInteger(scaled, precision);
  }

  /**
   * Adds two quantities exactly without floating-point error.
   */
  static add(
    q1: number | string,
    q2: number | string,
    precision = QuantityUtil.DEFAULT_PRECISION,
  ): string {
    const s1 = this.toScaledInteger(q1, precision);
    const s2 = this.toScaledInteger(q2, precision);
    return this.fromScaledInteger(s1 + s2, precision);
  }

  /**
   * Subtracts q2 from q1 exactly without floating-point error.
   */
  static subtract(
    q1: number | string,
    q2: number | string,
    precision = QuantityUtil.DEFAULT_PRECISION,
  ): string {
    const s1 = this.toScaledInteger(q1, precision);
    const s2 = this.toScaledInteger(q2, precision);
    return this.fromScaledInteger(s1 - s2, precision);
  }

  /**
   * Compares two quantities.
   * Returns:
   *   -1 if q1 < q2
   *    0 if q1 == q2
   *    1 if q1 > q2
   */
  static compare(
    q1: number | string,
    q2: number | string,
    precision = QuantityUtil.DEFAULT_PRECISION,
  ): number {
    const s1 = this.toScaledInteger(q1, precision);
    const s2 = this.toScaledInteger(q2, precision);
    if (s1 < s2) return -1;
    if (s1 > s2) return 1;
    return 0;
  }

  /**
   * Checks whether a quantity is strictly greater than zero.
   */
  static isPositive(quantity: number | string, precision = QuantityUtil.DEFAULT_PRECISION): boolean {
    return this.toScaledInteger(quantity, precision) > 0n;
  }

  /**
   * Checks whether a quantity is zero.
   */
  static isZero(quantity: number | string, precision = QuantityUtil.DEFAULT_PRECISION): boolean {
    return this.toScaledInteger(quantity, precision) === 0n;
  }
}
