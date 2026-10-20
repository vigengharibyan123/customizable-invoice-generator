import {
  addDays,
  dueDateForTerms,
  todayIsoDate,
  type Invoice,
  type InvoiceInput,
  type NewInvoiceDefaults,
} from "@invoice/shared";
import { createId } from "@/lib/utils";

/** The editor works on raw strings exactly as typed; the shared schema validates them. */
export type InvoiceFormValues = InvoiceInput;
export type LineItemValues = InvoiceFormValues["lineItems"][number];
export type CustomFieldValues = InvoiceFormValues["customFields"][number];

export function newLineItem(): LineItemValues {
  return { id: createId(), description: "", quantity: "1", unitPrice: "" };
}

export function newCustomField(label = ""): CustomFieldValues {
  return { id: createId(), label, value: "", visible: true };
}

/** A fresh invoice: next number, issued today, Net 30, business details carried over. */
export function blankInvoice(defaults: NewInvoiceDefaults, today = todayIsoDate()): InvoiceFormValues {
  return {
    number: defaults.number,
    issueDate: today,
    dueDate: addDays(today, 30),
    paymentTerms: "net_30",
    business: { ...defaults.business },
    customer: { name: "", email: "", address: "" },
    lineItems: [newLineItem()],
    discount: "0",
    taxRate: "0",
    customFields: [],
    notes: "",
    accentColor: defaults.accentColor,
  };
}

export function toFormValues(invoice: Invoice): InvoiceFormValues {
  return {
    number: invoice.number,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    paymentTerms: invoice.paymentTerms,
    business: { ...invoice.business },
    customer: { ...invoice.customer },
    lineItems: invoice.lineItems.map((item) => ({ ...item })),
    discount: invoice.discount,
    taxRate: invoice.taxRate,
    customFields: invoice.customFields.map((field) => ({ ...field })),
    notes: invoice.notes,
    accentColor: invoice.accentColor,
  };
}

/** A new draft that copies the customer, items and terms of an existing invoice. */
export function duplicateInvoice(source: Invoice, defaults: NewInvoiceDefaults, today = todayIsoDate()): InvoiceFormValues {
  const base = blankInvoice(defaults, today);
  return {
    ...base,
    paymentTerms: source.paymentTerms === "custom" ? base.paymentTerms : source.paymentTerms,
    dueDate: source.paymentTerms === "custom" ? base.dueDate : (dueDateForTerms(today, source.paymentTerms) ?? base.dueDate),
    customer: { ...source.customer },
    lineItems: source.lineItems.map((item) => ({ ...item, id: createId() })),
    discount: source.discount,
    taxRate: source.taxRate,
    customFields: source.customFields.map((field) => ({ ...field, id: createId() })),
    notes: source.notes,
  };
}
