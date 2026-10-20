import { describe, expect, it } from "vitest";
import { addDays, dueDateForTerms, isIsoDate, paymentTermsForDates } from "./dates";
import { formatCents, formatDate, formatPercent, formatQuantity } from "./format";
import { displayStatus, nextInvoiceNumber } from "./status";

describe("dates and payment terms", () => {
  it("adds days across month and leap-year boundaries", () => {
    expect(addDays("2026-10-20", 30)).toBe("2026-11-19");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("derives due dates from terms and terms from dates", () => {
    expect(dueDateForTerms("2026-10-20", "net_15")).toBe("2026-11-04");
    expect(dueDateForTerms("2026-10-20", "due_on_receipt")).toBe("2026-10-20");
    expect(dueDateForTerms("2026-10-20", "custom")).toBeNull();
    expect(paymentTermsForDates("2026-10-20", "2026-12-19")).toBe("net_60");
    expect(paymentTermsForDates("2026-10-20", "2026-10-27")).toBe("custom");
  });

  it("validates calendar dates", () => {
    expect(isIsoDate("2026-10-20")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("20-10-2026")).toBe(false);
  });
});

describe("formatting", () => {
  it("formats US currency, quantities, percents and dates", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatQuantity("1.500")).toBe("1.5");
    expect(formatPercent("8.875")).toBe("8.875%");
    expect(formatDate("2026-10-20")).toBe("Oct 20, 2026");
  });
});

describe("invoice status and numbering", () => {
  it("marks sent invoices past their due date as overdue", () => {
    expect(displayStatus("sent", "2026-10-19", "2026-10-20")).toBe("overdue");
    expect(displayStatus("sent", "2026-10-20", "2026-10-20")).toBe("sent");
    expect(displayStatus("draft", "2020-01-01", "2026-10-20")).toBe("draft");
  });

  it("suggests the next sequential invoice number", () => {
    expect(nextInvoiceNumber([])).toBe("INV-0001");
    expect(nextInvoiceNumber(["INV-0002", "INV-0010", "CUSTOM-99"])).toBe("INV-0011");
  });
});
