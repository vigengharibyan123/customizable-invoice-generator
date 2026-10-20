import { randomUUID } from "node:crypto";
import {
  calculateTotals,
  centsToDecimal,
  nextInvoiceNumber,
  parseDecimal,
  toCents,
  type Invoice,
  type InvoiceData,
  type InvoiceSummary,
  type InvoiceTotals,
  type NewInvoiceDefaults,
} from "@invoice/shared";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { invoiceCustomFields, invoiceLineItems, invoices } from "../db/schema";
import { ConflictError } from "../errors";
import { DEFAULT_BUSINESS } from "./default-business";

export type RemoveResult = "deleted" | "not_found" | "sent";

export interface InvoiceRepository {
  list(): InvoiceSummary[];
  get(id: string): Invoice | null;
  create(data: InvoiceData): Invoice;
  update(id: string, data: InvoiceData): Invoice | null;
  remove(id: string): RemoveResult;
  markSent(id: string, sentAt: string): Invoice | null;
  defaults(): NewInvoiceDefaults;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type InvoiceRow = typeof invoices.$inferSelect & {
  lineItems: (typeof invoiceLineItems.$inferSelect)[];
  customFields: (typeof invoiceCustomFields.$inferSelect)[];
};

/** "1.500" → "1.5". Values have already passed the shared schema, so this never throws in practice. */
function normalizeDecimal(value: string): string {
  const decimal = parseDecimal(value);
  if (!decimal) throw new Error(`Expected a decimal string, got "${value}"`);
  return decimal.toString();
}

function invoiceColumns(data: InvoiceData, totals: InvoiceTotals) {
  return {
    number: data.number,
    issueDate: data.issueDate,
    dueDate: data.dueDate,
    paymentTerms: data.paymentTerms,
    businessName: data.business.name,
    businessEmail: data.business.email,
    businessPhone: data.business.phone,
    businessAddress: data.business.address,
    customerName: data.customer.name,
    customerEmail: data.customer.email,
    customerAddress: data.customer.address,
    discountCents: totals.discountCents,
    taxRate: normalizeDecimal(data.taxRate),
    notes: data.notes,
    subtotalCents: totals.subtotalCents,
    taxCents: totals.taxCents,
    totalCents: totals.totalCents,
  };
}

function insertChildren(
  tx: Transaction,
  invoiceId: string,
  data: InvoiceData,
  totals: InvoiceTotals,
): void {
  // Child ids are always generated here: ids sent by a client could clash with other invoices' rows.
  if (data.lineItems.length > 0) {
    tx.insert(invoiceLineItems)
      .values(
        data.lineItems.map((item, position) => ({
          id: randomUUID(),
          invoiceId,
          position,
          description: item.description,
          quantity: normalizeDecimal(item.quantity),
          unitPriceCents: toCents(item.unitPrice),
          amountCents: totals.lineAmountsCents[position],
        })),
      )
      .run();
  }
  if (data.customFields.length > 0) {
    tx.insert(invoiceCustomFields)
      .values(
        data.customFields.map((field, position) => ({
          id: randomUUID(),
          invoiceId,
          position,
          label: field.label,
          value: field.value,
          visible: field.visible,
        })),
      )
      .run();
  }
}

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    status: row.status,
    sentAt: row.sentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    number: row.number,
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paymentTerms: row.paymentTerms,
    business: {
      name: row.businessName,
      email: row.businessEmail,
      phone: row.businessPhone,
      address: row.businessAddress,
    },
    customer: {
      name: row.customerName,
      email: row.customerEmail,
      address: row.customerAddress,
    },
    lineItems: row.lineItems.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: centsToDecimal(item.unitPriceCents),
    })),
    discount: centsToDecimal(row.discountCents),
    taxRate: row.taxRate,
    customFields: row.customFields.map(({ id, label, value, visible }) => ({
      id,
      label,
      value,
      visible,
    })),
    notes: row.notes,
    // Totals come from the stored snapshot rather than being recalculated on every read.
    totals: {
      lineAmountsCents: row.lineItems.map((item) => item.amountCents),
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      taxableCents: row.subtotalCents - row.discountCents,
      taxCents: row.taxCents,
      totalCents: row.totalCents,
    },
  };
}

/** Drizzle wraps driver errors, so look through the `cause` chain for SQLite's own error. */
function isUniqueViolation(error: unknown, column: string): boolean {
  for (let current: unknown = error; current instanceof Error; current = current.cause) {
    const { code } = current as { code?: unknown };
    if (code === "SQLITE_CONSTRAINT_UNIQUE" && current.message.includes(column)) return true;
  }
  return false;
}

function rethrowNumberConflict<T>(number: string, write: () => T): T {
  try {
    return write();
  } catch (error) {
    if (isUniqueViolation(error, "invoices.number")) {
      const message = `Invoice number ${number} is already used`;
      throw new ConflictError(message, { number: message });
    }
    throw error;
  }
}

export function createInvoiceRepository(
  db: Database,
  now: () => Date = () => new Date(),
): InvoiceRepository {
  function get(id: string): Invoice | null {
    const row = db.query.invoices
      .findFirst({
        where: eq(invoices.id, id),
        with: {
          lineItems: { orderBy: [asc(invoiceLineItems.position)] },
          customFields: { orderBy: [asc(invoiceCustomFields.position)] },
        },
      })
      .sync();
    return row ? toInvoice(row) : null;
  }

  function getSaved(id: string): Invoice {
    const invoice = get(id);
    if (!invoice) throw new Error(`Invoice ${id} is missing right after it was saved`);
    return invoice;
  }

  return {
    get,

    list() {
      return db
        .select({
          id: invoices.id,
          number: invoices.number,
          status: invoices.status,
          customerName: invoices.customerName,
          issueDate: invoices.issueDate,
          dueDate: invoices.dueDate,
          totalCents: invoices.totalCents,
          sentAt: invoices.sentAt,
          updatedAt: invoices.updatedAt,
        })
        .from(invoices)
        .orderBy(desc(invoices.issueDate), desc(invoices.createdAt))
        .all();
    },

    create(data) {
      const id = randomUUID();
      const timestamp = now().toISOString();
      const totals = calculateTotals(data);
      rethrowNumberConflict(data.number, () =>
        db.transaction((tx) => {
          tx.insert(invoices)
            .values({
              id,
              ...invoiceColumns(data, totals),
              createdAt: timestamp,
              updatedAt: timestamp,
            })
            .run();
          insertChildren(tx, id, data, totals);
        }),
      );
      return getSaved(id);
    },

    update(id, data) {
      const totals = calculateTotals(data);
      const found = rethrowNumberConflict(data.number, () =>
        db.transaction((tx) => {
          const { changes } = tx
            .update(invoices)
            .set({ ...invoiceColumns(data, totals), updatedAt: now().toISOString() })
            .where(eq(invoices.id, id))
            .run();
          if (changes === 0) return false;
          // Items and fields are replaced wholesale: the submitted list is the new truth, in order.
          tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).run();
          tx.delete(invoiceCustomFields).where(eq(invoiceCustomFields.invoiceId, id)).run();
          insertChildren(tx, id, data, totals);
          return true;
        }),
      );
      return found ? getSaved(id) : null;
    },

    remove(id) {
      // Sent invoices stay on record: accounting practice is to void them, not delete them.
      const { changes } = db
        .delete(invoices)
        .where(and(eq(invoices.id, id), eq(invoices.status, "draft")))
        .run();
      if (changes > 0) return "deleted";
      const existing = db
        .select({ id: invoices.id })
        .from(invoices)
        .where(eq(invoices.id, id))
        .get();
      return existing ? "sent" : "not_found";
    },

    markSent(id, sentAt) {
      const { changes } = db
        .update(invoices)
        .set({ status: "sent", sentAt, updatedAt: sentAt })
        .where(eq(invoices.id, id))
        .run();
      return changes > 0 ? getSaved(id) : null;
    },

    defaults() {
      const numbers = db.select({ number: invoices.number }).from(invoices).all();
      const latestBusiness = db
        .select({
          name: invoices.businessName,
          email: invoices.businessEmail,
          phone: invoices.businessPhone,
          address: invoices.businessAddress,
        })
        .from(invoices)
        .orderBy(desc(invoices.createdAt))
        .limit(1)
        .get();
      return {
        number: nextInvoiceNumber(numbers.map((row) => row.number)),
        business: latestBusiness ?? DEFAULT_BUSINESS,
      };
    },
  };
}
