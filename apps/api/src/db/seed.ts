import { randomUUID } from "node:crypto";
import {
  addDays,
  formatCents,
  invoiceInputSchema,
  todayIsoDate,
  type InvoiceInput,
} from "@invoice/shared";
import { loadEnv } from "../env";
import { DEFAULT_BUSINESS } from "../invoices/default-business";
import { createInvoiceRepository } from "../invoices/repository";
import { createDatabase } from "./client";
import { invoices } from "./schema";

/*
 * Demo data: fictional companies, reserved `.example` domains (RFC 2606) and 555-01xx phone
 * numbers. Dates are relative to today, so the list always shows one overdue, one sent and one
 * draft invoice. Everything goes through the repository, so the totals are computed the same
 * way as for invoices created in the app.
 *
 *   npm run db:seed   seeds an empty database
 *   npm run db:reset  deletes every invoice first
 */

const NOTES =
  "Payment due within the terms above. Pay by ACH to Lumen & Oak Studio, Routing 000000000, " +
  "Account 0000000000 (demo details), or by check. Thank you for your business!";

interface DemoInvoice {
  input: InvoiceInput;
  sent: boolean;
}

const item = (description: string, quantity: string, unitPrice: string) => ({
  id: randomUUID(),
  description,
  quantity,
  unitPrice,
});

const field = (label: string, value: string, visible = true) => ({
  id: randomUUID(),
  label,
  value,
  visible,
});

/** "2026-10-20" → "November" */
function nextMonthName(isoDate: string): string {
  const [year, month] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
}

function demoInvoices(today: string): DemoInvoice[] {
  const firstIssued = addDays(today, -45);
  const secondIssued = addDays(today, -10);

  return [
    {
      sent: true,
      input: {
        number: "INV-0001",
        issueDate: firstIssued,
        dueDate: addDays(firstIssued, 30),
        paymentTerms: "net_30",
        business: DEFAULT_BUSINESS,
        customer: {
          name: "Harbor & Pine Coffee Roasters",
          email: "ap@harborandpine.example",
          address: "88 Water St\nPortland, ME 04101",
        },
        lineItems: [
          item("Brand identity — logo suite & guidelines", "1", "3200.00"),
          item("Packaging design — 3 coffee bag variants", "3", "450.00"),
        ],
        discount: "0",
        taxRate: "0",
        customFields: [field("PO Number", "HP-2291"), field("Project", "Spring rebrand")],
        notes: NOTES,
      },
    },
    {
      sent: true,
      input: {
        number: "INV-0002",
        issueDate: secondIssued,
        dueDate: addDays(secondIssued, 30),
        paymentTerms: "net_30",
        business: DEFAULT_BUSINESS,
        customer: {
          name: "Northside Climbing Co.",
          email: "accounts@northsideclimbing.example",
          address: "1250 Flushing Ave, Unit 4\nBrooklyn, NY 11237",
        },
        lineItems: [
          item("Website design — 6 page templates", "1", "4800.00"),
          item("Development (hourly)", "22.5", "95.00"),
          item("Stock photography license", "4", "49.00"),
        ],
        discount: "250.00",
        taxRate: "8.875",
        customFields: [field("Internal note", "Referred by Maya at Harbor & Pine", false)],
        notes: NOTES,
      },
    },
    {
      sent: false,
      input: {
        number: "INV-0003",
        issueDate: today,
        dueDate: addDays(today, 15),
        paymentTerms: "net_15",
        business: DEFAULT_BUSINESS,
        customer: {
          name: "Meridian Dental Group",
          email: "office@meridiandental.example",
          address: "530 Fifth Ave, Floor 9\nNew York, NY 10036",
        },
        lineItems: [
          item(`Monthly website care plan — ${nextMonthName(today)}`, "1", "350.00"),
          item("Content updates", "1.5", "85.00"),
        ],
        discount: "0",
        taxRate: "8.875",
        customFields: [field("PO Number", "MD-0412")],
        notes: NOTES,
      },
    },
  ];
}

/** Mid-afternoon UTC on the issue date, never in the future, so createdAt/sentAt fit the story. */
function timestampOn(isoDate: string, now: Date): Date {
  const onIssueDate = new Date(`${isoDate}T15:00:00.000Z`);
  return onIssueDate < now ? onIssueDate : now;
}

function main(): void {
  const env = loadEnv();
  const reset = process.argv.includes("--reset");
  const db = createDatabase(env.DATABASE_PATH);

  try {
    const existing = createInvoiceRepository(db).list().length;
    if (existing > 0 && !reset) {
      console.log(
        `The database already has ${existing} invoice(s), so nothing was seeded.\n` +
          `Run "npm run db:reset" to replace them with the demo data.`,
      );
      return;
    }
    // Line items and custom fields go with their invoices (ON DELETE CASCADE).
    if (reset) db.delete(invoices).run();

    const now = new Date();
    for (const { input, sent } of demoInvoices(todayIsoDate(now))) {
      const at = timestampOn(input.issueDate, now);
      const repo = createInvoiceRepository(db, () => at);
      const created = repo.create(invoiceInputSchema.parse(input));
      const invoice = sent ? (repo.markSent(created.id, at.toISOString()) ?? created) : created;
      console.log(
        `  ${invoice.number}  ${invoice.status.padEnd(5)}  ${formatCents(invoice.totals.totalCents).padStart(10)}  ${invoice.customer.name}`,
      );
    }
    console.log(`Seeded 3 demo invoices into ${env.DATABASE_PATH}`);
  } finally {
    db.$client.close();
  }
}

main();
