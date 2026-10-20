import { Big } from "big.js";
import { z } from "zod";
import { calculateTotals, type InvoiceTotals } from "./calculate";
import { isIsoDate, PAYMENT_TERMS } from "./dates";
import { decimalPlaces, isDecimalString } from "./money";
import { ACCENT_COLOR_KEYS, DEFAULT_ACCENT_COLOR, type AccentColor } from "./theme";

/**
 * One schema validates invoices everywhere: in the browser while typing (react-hook-form),
 * in the API before anything is stored, and in tests. The database adds CHECK constraints
 * as a last line of defence.
 */

interface DecimalRules {
  label: string;
  maxDecimals: number;
  max: string;
  /** Require a value above zero (quantities). */
  positive?: boolean;
  /** Treat an empty field as 0 (discount, tax rate). */
  emptyMeansZero?: boolean;
}

const groupedNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });

function decimalString({ label, maxDecimals, max, positive, emptyMeansZero }: DecimalRules) {
  return z
    .string()
    .trim()
    .transform((value) => (value === "" && emptyMeansZero ? "0" : value))
    .superRefine((value, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (value === "") return fail(`Enter ${/^[aeiou]/i.test(label) ? "an" : "a"} ${label.toLowerCase()}`);
      if (value.startsWith("-")) return fail(`${label} can't be negative`);
      if (!isDecimalString(value)) return fail("Enter a number, like 12.50");
      if (decimalPlaces(value) > maxDecimals) {
        return fail(
          maxDecimals === 0 ? "Use a whole number" : `Use at most ${maxDecimals} decimal places`,
        );
      }
      const amount = new Big(value);
      if (positive && amount.lte(0)) return fail(`${label} must be more than 0`);
      if (amount.gt(max)) return fail(`${label} can't be more than ${groupedNumber.format(Number(max))}`);
    });
}

const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Enter a valid email address, like name@example.com",
  });

const isoDate = (label: string) =>
  z.string().trim().refine(isIsoDate, { message: `Enter a valid ${label}` });

export const businessSchema = z.object({
  name: z.string().trim().min(1, "Enter your business name").max(120),
  email: optionalEmail,
  phone: z.string().trim().max(40),
  address: z.string().trim().max(300),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1, "Enter the customer's name").max(120),
  email: optionalEmail,
  address: z.string().trim().max(300),
});

const quantitySchema = decimalString({
  label: "Quantity",
  maxDecimals: 3,
  max: "1000000",
  positive: true,
});
const unitPriceSchema = decimalString({ label: "Price", maxDecimals: 2, max: "10000000" });
const discountSchema = decimalString({
  label: "Discount",
  maxDecimals: 2,
  max: "1000000000",
  emptyMeansZero: true,
});

export const lineItemSchema = z.object({
  id: z.string().min(1),
  description: z.string().trim().min(1, "Describe the item or service").max(500),
  quantity: quantitySchema,
  unitPrice: unitPriceSchema,
});

export const customFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1, "Add a label").max(60),
  value: z.string().trim().min(1, "Add a value").max(300),
  visible: z.boolean(),
});

export const invoiceInputSchema = z
  .object({
    number: z
      .string()
      .trim()
      .min(1, "Enter an invoice number")
      .max(32, "Keep the invoice number under 32 characters")
      .regex(/^[A-Za-z0-9][A-Za-z0-9\-_/.#]*$/, "Use letters, numbers and - _ / . #"),
    issueDate: isoDate("issue date"),
    dueDate: isoDate("due date"),
    paymentTerms: z.enum(PAYMENT_TERMS),
    business: businessSchema,
    customer: customerSchema,
    lineItems: z.array(lineItemSchema).min(1, "Add at least one item").max(100),
    discount: discountSchema,
    taxRate: decimalString({ label: "Tax rate", maxDecimals: 3, max: "100", emptyMeansZero: true }),
    customFields: z.array(customFieldSchema).max(20, "Use at most 20 custom fields"),
    notes: z.string().trim().max(2000),
    accentColor: z.enum(ACCENT_COLOR_KEYS).default(DEFAULT_ACCENT_COLOR),
  })
  .superRefine((invoice, ctx) => {
    if (isIsoDate(invoice.issueDate) && isIsoDate(invoice.dueDate)) {
      if (invoice.dueDate < invoice.issueDate) {
        ctx.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "Due date can't be before the issue date",
        });
      }
    }
    // Discount vs subtotal is only meaningful once there are items and every amount is valid.
    const amountsAreValid =
      invoice.lineItems.length > 0 &&
      discountSchema.safeParse(invoice.discount).success &&
      invoice.lineItems.every(
        (item) =>
          quantitySchema.safeParse(item.quantity).success &&
          unitPriceSchema.safeParse(item.unitPrice).success,
      );
    if (amountsAreValid) {
      const { subtotalCents, discountCents } = calculateTotals({ ...invoice, taxRate: "0" });
      if (discountCents > subtotalCents) {
        ctx.addIssue({
          code: "custom",
          path: ["discount"],
          message: "Discount can't be more than the subtotal",
        });
      }
    }
  });

/** Raw form/API input (all amounts are decimal strings). */
export type InvoiceInput = z.input<typeof invoiceInputSchema>;
/** Validated, trimmed invoice data. */
export type InvoiceData = z.output<typeof invoiceInputSchema>;
export type LineItem = z.output<typeof lineItemSchema>;
export type CustomField = z.output<typeof customFieldSchema>;
export type Business = z.output<typeof businessSchema>;
export type Customer = z.output<typeof customerSchema>;

export const INVOICE_STATUSES = ["draft", "sent"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

/** A stored invoice as returned by the API. */
export interface Invoice extends InvoiceData {
  id: string;
  status: InvoiceStatus;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  totals: InvoiceTotals;
}

/** A row in the invoice list. */
export interface InvoiceSummary {
  id: string;
  number: string;
  status: InvoiceStatus;
  customerName: string;
  issueDate: string;
  dueDate: string;
  totalCents: number;
  sentAt: string | null;
  updatedAt: string;
}

export const sendInvoiceSchema = z.object({
  to: z.string().trim().pipe(z.email("Enter a valid email address, like name@example.com")),
  subject: z
    .string()
    .trim()
    .min(1, "Enter a subject")
    .max(200)
    .refine((value) => !/[\r\n]/.test(value), { message: "Keep the subject on one line" }),
  message: z.string().trim().max(2000),
});
export type SendInvoiceInput = z.input<typeof sendInvoiceSchema>;

/** Defaults handed to the editor when starting a new invoice. */
export interface NewInvoiceDefaults {
  number: string;
  business: Business;
  /** Brand color of the most recent invoice, so new invoices stay on-brand. */
  accentColor: AccentColor;
}

/** Shape of every API error response body. */
export interface ApiErrorBody {
  error: {
    code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT" | "EMAIL_FAILED" | "RATE_LIMITED" | "INTERNAL";
    message: string;
    /** Dot-separated field paths → messages, e.g. { "lineItems.0.quantity": "..." }. */
    fieldErrors?: Record<string, string>;
  };
}

/** Flattens Zod issues into { "lineItems.0.quantity": "message" } (first message per field). */
export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.map(String).join(".");
    fieldErrors[path] ??= issue.message;
  }
  return fieldErrors;
}
