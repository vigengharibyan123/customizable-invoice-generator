import type { InvoiceInput } from "@invoice/shared";
import { createApp } from "../src/app";
import { createDatabase } from "../src/db/client";
import { createMailer, type Mailer } from "../src/email/transport";
import { parseEnv } from "../src/env";
import { createInvoiceRepository } from "../src/invoices/repository";

export const testEnv = parseEnv({ NODE_ENV: "test" });

/** A fresh in-memory database and app per test, with the json (no network) mailer by default. */
export function createTestApp(mailer: Mailer = createMailer(testEnv)) {
  const db = createDatabase(":memory:");
  const repo = createInvoiceRepository(db);
  const app = createApp({ repo, mailer, env: testEnv });
  return { app, db, repo };
}

/** 2 × $50.00, $10.00 discount, 10% tax → $99.00. */
export function invoiceInput(overrides: Partial<InvoiceInput> = {}): InvoiceInput {
  return {
    number: "INV-0042",
    issueDate: "2026-10-20",
    dueDate: "2026-11-19",
    paymentTerms: "net_30",
    business: {
      name: "Lumen & Oak Studio",
      email: "billing@lumenandoak.example",
      phone: "(718) 555-0142",
      address: "214 Atlantic Ave, Suite 3\nBrooklyn, NY 11201",
    },
    customer: {
      name: "Meridian Dental Group",
      email: "office@meridiandental.example",
      address: "530 Fifth Ave, Floor 9\nNew York, NY 10036",
    },
    lineItems: [
      {
        id: "client-item-1",
        description: "Website care plan — November",
        quantity: "2",
        unitPrice: "50",
      },
    ],
    discount: "10",
    taxRate: "10",
    customFields: [
      { id: "client-field-1", label: "PO Number", value: "MD-0412", visible: true },
      { id: "client-field-2", label: "Internal note", value: "Renews in March", visible: false },
    ],
    notes: "Thank you for your business!",
    ...overrides,
  };
}

export const sendRequest = {
  to: "office@meridiandental.example",
  subject: "Invoice INV-0042 from Lumen & Oak Studio",
  message: "Hi Dana,\nthe invoice for this month is attached below.",
};
