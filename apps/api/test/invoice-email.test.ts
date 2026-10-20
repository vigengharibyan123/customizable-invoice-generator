import { invoiceInputSchema, type Invoice } from "@invoice/shared";
import { beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../src/db/client";
import { renderInvoiceEmail } from "../src/email/invoice-email";
import { createInvoiceRepository } from "../src/invoices/repository";
import { invoiceInput } from "./fixtures";

let invoice: Invoice;

beforeAll(() => {
  const db = createDatabase(":memory:");
  invoice = createInvoiceRepository(db).create(
    invoiceInputSchema.parse(invoiceInput({ notes: "Pay by ACH.\nThank you!" })),
  );
  db.$client.close();
});

describe("renderInvoiceEmail", () => {
  it("renders the amount due, due date, items and totals", () => {
    const { html } = renderInvoiceEmail(invoice, "");

    expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(html).toContain("Invoice INV-0042");
    expect(html).toContain("$99.00");
    expect(html).toContain("Due Nov 19, 2026");
    expect(html).toContain("Website care plan — November");
    expect(html).toContain("Tax (10%)");
    expect(html).toContain("−$10.00");
  });

  it("escapes the personal message and keeps its line breaks", () => {
    const { html } = renderInvoiceEmail(invoice, 'Hi Dana,\n<img src=x onerror="alert(1)">');

    expect(html).toContain("Hi Dana,<br/>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img");
  });

  it("shows only visible custom fields", () => {
    const { html, text } = renderInvoiceEmail(invoice, "");

    expect(html).toContain("PO Number:");
    expect(text).toContain("PO Number: MD-0412");
    expect(html).not.toContain("Renews in March");
    expect(text).not.toContain("Renews in March");
  });

  it("builds a readable plain-text version", () => {
    const { text } = renderInvoiceEmail(invoice, "Hi Dana,\nthanks for the quick turnaround.");

    expect(text).toContain("Amount due: $99.00\nDue: Nov 19, 2026");
    expect(text).toContain("Hi Dana,\nthanks for the quick turnaround.");
    expect(text).toContain("- Website care plan — November: 2 × $50.00 = $100.00");
    expect(text).toContain("Discount: −$10.00\nTax (10%): $9.00\nTotal: $99.00");
    expect(text).toContain("Notes:\nPay by ACH.\nThank you!");
    expect(text).not.toContain("<");
  });
});
