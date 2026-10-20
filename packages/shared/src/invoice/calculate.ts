import Big from "big.js";
import { parseDecimal, roundCents, toCents } from "./money";

export interface TotalsInput {
  lineItems: ReadonlyArray<{ quantity: string; unitPrice: string }>;
  discount: string;
  taxRate: string;
}

/** Every amount is in integer cents. */
export interface InvoiceTotals {
  lineAmountsCents: number[];
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Calculates totals in exactly the order the spec requires:
 *   1. line amount = quantity × unit price, rounded to cents
 *   2. subtotal    = sum of the rounded line amounts
 *   3. taxable     = subtotal − fixed discount
 *   4. tax         = taxable × rate %, rounded to cents
 *   5. total       = taxable + tax
 * Rounding is half up (half away from zero), the usual commercial rule for USD.
 *
 * Inputs must already be valid decimal strings (see `invoiceInputSchema`);
 * use `calculateLiveTotals` for half-typed form values.
 */
export function calculateTotals(input: TotalsInput): InvoiceTotals {
  const lineAmountsCents = input.lineItems.map((item) =>
    toCents(new Big(item.quantity).times(item.unitPrice)),
  );
  const subtotalCents = lineAmountsCents.reduce((sum, amount) => sum + amount, 0);
  const discountCents = toCents(input.discount);
  const taxableCents = subtotalCents - discountCents;
  const taxCents = roundCents(new Big(taxableCents).times(input.taxRate).div(100));

  return {
    lineAmountsCents,
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxableCents + taxCents,
  };
}

export interface LiveTotals extends InvoiceTotals {
  /** True when the entered discount is larger than the subtotal (a validation error). */
  discountExceedsSubtotal: boolean;
}

/**
 * Totals for the live preview while the user is typing: anything that is not (yet) a valid
 * number counts as 0, and an oversized discount is capped at the subtotal so the preview never
 * shows negative money. The form shows the matching validation errors next to the fields.
 */
export function calculateLiveTotals(input: TotalsInput): LiveTotals {
  const safe = (value: string) => (parseDecimal(value) ?? new Big(0)).toString();
  const lineItems = input.lineItems.map((item) => ({
    quantity: safe(item.quantity),
    unitPrice: safe(item.unitPrice),
  }));
  const { subtotalCents } = calculateTotals({ lineItems, discount: "0", taxRate: "0" });
  const discountExceedsSubtotal = toCents(safe(input.discount)) > subtotalCents;
  const discount = discountExceedsSubtotal
    ? new Big(subtotalCents).div(100).toString()
    : safe(input.discount);
  const taxRate = new Big(safe(input.taxRate)).gt(100) ? "0" : safe(input.taxRate);

  return { ...calculateTotals({ lineItems, discount, taxRate }), discountExceedsSubtotal };
}
