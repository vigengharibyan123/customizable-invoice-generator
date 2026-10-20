import { ACCENT_COLOR_KEYS, INVOICE_STATUSES, PAYMENT_TERMS } from "@invoice/shared";
import { relations, sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Money is stored as integer cents; quantities and tax rates as normalized decimal strings,
 * so no value ever passes through binary floating point. The CHECK constraints repeat the
 * most important validation rules as a last line of defence.
 */
export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    number: text("number").notNull().unique(),
    status: text("status", { enum: INVOICE_STATUSES }).notNull().default("draft"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    paymentTerms: text("payment_terms", { enum: PAYMENT_TERMS }).notNull(),
    accentColor: text("accent_color", { enum: ACCENT_COLOR_KEYS }).notNull().default("oak"),
    businessName: text("business_name").notNull().default(""),
    businessEmail: text("business_email").notNull().default(""),
    businessPhone: text("business_phone").notNull().default(""),
    businessAddress: text("business_address").notNull().default(""),
    customerName: text("customer_name").notNull().default(""),
    customerEmail: text("customer_email").notNull().default(""),
    customerAddress: text("customer_address").notNull().default(""),
    discountCents: integer("discount_cents").notNull(),
    taxRate: text("tax_rate").notNull(),
    notes: text("notes").notNull().default(""),
    // Server-computed snapshot, so a stored invoice never changes if the rounding rules do.
    subtotalCents: integer("subtotal_cents").notNull(),
    taxCents: integer("tax_cents").notNull(),
    totalCents: integer("total_cents").notNull(),
    sentAt: text("sent_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check("invoices_status_check", sql`${table.status} in ('draft', 'sent')`),
    check(
      "invoices_discount_check",
      sql`${table.discountCents} >= 0 and ${table.discountCents} <= ${table.subtotalCents}`,
    ),
    check("invoices_dates_check", sql`${table.dueDate} >= ${table.issueDate}`),
    check("invoices_tax_check", sql`${table.taxCents} >= 0`),
    check(
      "invoices_total_check",
      sql`${table.totalCents} = ${table.subtotalCents} - ${table.discountCents} + ${table.taxCents}`,
    ),
    index("invoices_issue_date_idx").on(table.issueDate),
  ],
);

export const invoiceLineItems = sqliteTable(
  "invoice_line_items",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    description: text("description").notNull(),
    quantity: text("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    amountCents: integer("amount_cents").notNull(),
  },
  (table) => [
    check("invoice_line_items_unit_price_check", sql`${table.unitPriceCents} >= 0`),
    check("invoice_line_items_amount_check", sql`${table.amountCents} >= 0`),
    index("invoice_line_items_invoice_id_idx").on(table.invoiceId),
  ],
);

export const invoiceCustomFields = sqliteTable(
  "invoice_custom_fields",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    label: text("label").notNull(),
    value: text("value").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
  },
  (table) => [index("invoice_custom_fields_invoice_id_idx").on(table.invoiceId)],
);

export const invoicesRelations = relations(invoices, ({ many }) => ({
  lineItems: many(invoiceLineItems),
  customFields: many(invoiceCustomFields),
}));

export const invoiceLineItemsRelations = relations(invoiceLineItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceLineItems.invoiceId], references: [invoices.id] }),
}));

export const invoiceCustomFieldsRelations = relations(invoiceCustomFields, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceCustomFields.invoiceId], references: [invoices.id] }),
}));
