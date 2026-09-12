/**
 * Money Utility
 * Avoids IEEE 754 floating-point inaccuracies by handling financial amounts as
 * exact integer minor units (e.g., paise, cents) and exact decimal strings.
 */
export class MoneyUtil {
  /**
   * Converts a major currency string or number (e.g., 125.50) into integer minor units (e.g., 12550n).
   * Parses via string arithmetic to avoid binary floating-point rounding errors.
   */
  static toMinorUnits(amount: number | string, decimalPlaces = 2): bigint {
    const raw = typeof amount === 'number' ? amount.toString() : amount.trim();
    if (!raw || isNaN(Number(raw))) {
      throw new Error(`Invalid monetary amount: "${amount}"`);
    }

    const isNegative = raw.startsWith('-');
    const clean = isNegative ? raw.slice(1) : raw;
    const [wholePart, fractionalPart = ''] = clean.split('.');

    // Pad or truncate fractional part to the expected decimal places
    const paddedFraction = (fractionalPart + '0'.repeat(decimalPlaces)).slice(0, decimalPlaces);
    const combined = `${wholePart}${paddedFraction}`;

    const value = BigInt(combined);
    return isNegative ? -value : value;
  }

  /**
   * Converts integer minor units (e.g., 12550n) into a floating-point major amount (e.g., 125.50).
   * Note: Use only for presentation or display, never for internal accounting calculations.
   */
  static fromMinorUnits(minorUnits: bigint | number | string, decimalPlaces = 2): number {
    const decimalStr = this.toDecimalString(minorUnits, decimalPlaces);
    return parseFloat(decimalStr);
  }

  /**
   * Converts minor units into an exact decimal string (e.g. 12550n -> "125.50").
   */
  static toDecimalString(minorUnits: bigint | number | string, decimalPlaces = 2): string {
    const raw = BigInt(minorUnits).toString();
    const isNegative = raw.startsWith('-');
    const digits = isNegative ? raw.slice(1) : raw;

    if (digits.length <= decimalPlaces) {
      const padded = digits.padStart(decimalPlaces, '0');
      const formatted = `0.${padded}`;
      return isNegative ? `-${formatted}` : formatted;
    }

    const splitIdx = digits.length - decimalPlaces;
    const whole = digits.slice(0, splitIdx);
    const fraction = digits.slice(splitIdx);
    const formatted = `${whole}.${fraction}`;
    return isNegative ? `-${formatted}` : formatted;
  }

  /**
   * Formats minor units into standard localized currency string (e.g., "₹125.50").
   */
  static format(
    minorUnits: bigint | number | string,
    currency = 'INR',
    locale = 'en-IN',
    decimalPlaces = 2,
  ): string {
    const amount = this.fromMinorUnits(minorUnits, decimalPlaces);
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(amount);
  }
}
