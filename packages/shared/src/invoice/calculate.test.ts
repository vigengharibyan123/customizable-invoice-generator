import { describe, expect, it } from "vitest";
import { calculateLiveTotals, calculateTotals } from "./calculate";

const totalsFor = (
  lineItems: Array<[quantity: string, unitPrice: string]>,
  discount = "0",
  taxRate = "0",
) =>
  calculateTotals({
    lineItems: lineItems.map(([quantity, unitPrice]) => ({ quantity, unitPrice })),
    discount,
    taxRate,
  });

describe("calculateTotals", () => {
  it("matches the spec check: 2 × $50 − $10 discount + 10% tax = $99.00", () => {
    expect(totalsFor([["2", "50"]], "10", "10")).toEqual({
      lineAmountsCents: [10000],
      subtotalCents: 10000,
      discountCents: 1000,
      taxableCents: 9000,
      taxCents: 900,
      totalCents: 9900,
    });
  });

  it("rounds each line to cents half up, where binary floats get it wrong", () => {
    // 0.5 × 2.01 = 1.005 → $1.01 (Math.round(0.5 * 2.01 * 100) gives $1.00)
    expect(totalsFor([["0.5", "2.01"]]).lineAmountsCents).toEqual([101]);
    // 2.5 × 4.01 = 10.025 → $10.03 (floats give $10.02)
    expect(totalsFor([["2.5", "4.01"]]).lineAmountsCents).toEqual([1003]);
    // 1.5 × 33.33 = 49.995 → $50.00
    expect(totalsFor([["1.5", "33.33"]]).lineAmountsCents).toEqual([5000]);
  });

  it("sums the already-rounded line amounts, not the raw products", () => {
    // Each line is 0.333 × 1.00 = 0.333 → $0.33; three lines = $0.99 (not $1.00)
    const totals = totalsFor([
      ["0.333", "1"],
      ["0.333", "1"],
      ["0.333", "1"],
    ]);
    expect(totals.subtotalCents).toBe(99);
  });

  it("applies the discount before tax and rounds tax half up", () => {
    // taxable $10.05 × 8.875% = $0.8919375 → $0.89
    expect(totalsFor([["1", "12.05"]], "2", "8.875").taxCents).toBe(89);
    // taxable $0.10 × 5% = $0.005 → $0.01
    expect(totalsFor([["1", "0.10"]], "0", "5").taxCents).toBe(1);
  });

  it("handles a discount equal to the subtotal", () => {
    const totals = totalsFor([["3", "19.99"]], "59.97", "10");
    expect(totals).toMatchObject({ subtotalCents: 5997, taxableCents: 0, taxCents: 0, totalCents: 0 });
  });

  it("handles large amounts exactly", () => {
    const totals = totalsFor([["1000000", "9999999.99"]], "0", "8.875");
    expect(totals.subtotalCents).toBe(999_999_999_000_000);
    expect(Number.isSafeInteger(totals.totalCents)).toBe(true);
  });

  it("returns zeros for an invoice without items", () => {
    expect(totalsFor([]).totalCents).toBe(0);
  });
});

describe("calculateLiveTotals", () => {
  it("treats half-typed values as zero instead of producing NaN", () => {
    const totals = calculateLiveTotals({
      lineItems: [
        { quantity: "2", unitPrice: "50" },
        { quantity: "", unitPrice: "abc" },
      ],
      discount: "",
      taxRate: "10.",
    });
    expect(totals.subtotalCents).toBe(10000);
    expect(totals.totalCents).toBe(10000);
  });

  it("caps an oversized discount at the subtotal and flags it", () => {
    const totals = calculateLiveTotals({
      lineItems: [{ quantity: "1", unitPrice: "40" }],
      discount: "50",
      taxRate: "10",
    });
    expect(totals.discountExceedsSubtotal).toBe(true);
    expect(totals.totalCents).toBe(0);
  });
});
