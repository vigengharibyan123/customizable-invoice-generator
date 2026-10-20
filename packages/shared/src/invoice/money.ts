import { Big, type BigSource } from "big.js";

/**
 * User-entered amounts travel through the app as plain decimal strings ("12", "12.5", "0.75"):
 * no sign, no exponent, no thousands separators. They are only ever turned into numbers via
 * big.js, so binary floating point never touches money. Final amounts are integer cents.
 */
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

export function isDecimalString(value: string): boolean {
  return DECIMAL_PATTERN.test(value);
}

export function decimalPlaces(value: string): number {
  const fraction = value.split(".")[1];
  return fraction ? fraction.length : 0;
}

/** Returns the decimal as a Big, or null when the string is not a valid non-negative decimal. */
export function parseDecimal(value: string | null | undefined): Big | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return isDecimalString(trimmed) ? new Big(trimmed) : null;
}

/** Rounds a dollar amount to whole cents, half away from zero ("half up" for positive amounts). */
export function toCents(dollars: BigSource): number {
  return new Big(dollars).times(100).round(0, Big.roundHalfUp).toNumber();
}

/** Integer cents → fixed two-decimal string, e.g. 9900 → "99.00". */
export function centsToDecimal(cents: number): string {
  return new Big(cents).div(100).toFixed(2);
}

/** Rounds a value that is already in cents (e.g. cents × rate) to whole cents, half up. */
export function roundCents(cents: BigSource): number {
  return new Big(cents).round(0, Big.roundHalfUp).toNumber();
}
