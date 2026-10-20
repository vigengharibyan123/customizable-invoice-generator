import { describe, expect, it } from "vitest";
import { invoiceInputSchema, sendInvoiceSchema, toFieldErrors, type InvoiceInput } from "./schema";

const validInvoice = (): InvoiceInput => ({
  number: "INV-0001",
  issueDate: "2026-10-20",
  dueDate: "2026-11-19",
  paymentTerms: "net_30",
  business: { name: "Lumen & Oak Studio", email: "billing@lumenandoak.example", phone: "", address: "" },
  customer: { name: "Harbor & Pine Coffee", email: "", address: "" },
  lineItems: [{ id: "a", description: "Logo design", quantity: "2", unitPrice: "50" }],
  discount: "10",
  taxRate: "10",
  customFields: [{ id: "f", label: "PO Number", value: "HP-2291", visible: false }],
  notes: "",
});

function errorsFor(patch: (invoice: InvoiceInput) => void) {
  const invoice = validInvoice();
  patch(invoice);
  const result = invoiceInputSchema.safeParse(invoice);
  return result.success ? {} : toFieldErrors(result.error);
}

describe("invoiceInputSchema", () => {
  it("accepts a valid invoice", () => {
    expect(invoiceInputSchema.safeParse(validInvoice()).success).toBe(true);
  });

  it("rejects negative quantities, prices, discounts and tax rates", () => {
    expect(
      errorsFor((i) => {
        i.lineItems[0]!.quantity = "-1";
        i.lineItems[0]!.unitPrice = "-5";
        i.discount = "-1";
        i.taxRate = "-2";
      }),
    ).toEqual({
      "lineItems.0.quantity": "Quantity can't be negative",
      "lineItems.0.unitPrice": "Price can't be negative",
      discount: "Discount can't be negative",
      taxRate: "Tax rate can't be negative",
    });
  });

  it("rejects a discount larger than the subtotal", () => {
    expect(errorsFor((i) => (i.discount = "100.01"))).toEqual({
      discount: "Discount can't be more than the subtotal",
    });
    expect(errorsFor((i) => (i.discount = "100"))).toEqual({});
  });

  it("limits decimal places to cents for money", () => {
    expect(errorsFor((i) => (i.lineItems[0]!.unitPrice = "10.555"))).toEqual({
      "lineItems.0.unitPrice": "Use at most 2 decimal places",
    });
  });

  it("allows fractional quantities but not zero", () => {
    expect(errorsFor((i) => (i.lineItems[0]!.quantity = "1.5"))).toEqual({});
    expect(errorsFor((i) => (i.lineItems[0]!.quantity = "0"))).toEqual({
      "lineItems.0.quantity": "Quantity must be more than 0",
    });
  });

  it("caps the tax rate at 100%", () => {
    expect(errorsFor((i) => (i.taxRate = "100.5"))).toEqual({
      taxRate: "Tax rate can't be more than 100",
    });
  });

  it("treats empty discount and tax as zero", () => {
    const result = invoiceInputSchema.parse({ ...validInvoice(), discount: "", taxRate: " " });
    expect(result).toMatchObject({ discount: "0", taxRate: "0" });
  });

  it("rejects text where a number is expected", () => {
    expect(errorsFor((i) => (i.lineItems[0]!.quantity = "two"))).toEqual({
      "lineItems.0.quantity": "Enter a number, like 12.50",
    });
  });

  it("requires a due date on or after the issue date", () => {
    expect(errorsFor((i) => (i.dueDate = "2026-10-19"))).toEqual({
      dueDate: "Due date can't be before the issue date",
    });
  });

  it("rejects impossible calendar dates", () => {
    expect(errorsFor((i) => (i.issueDate = "2026-02-30"))).toHaveProperty("issueDate");
  });

  it("requires names, at least one item and labelled custom fields", () => {
    const errors = errorsFor((i) => {
      i.business.name = " ";
      i.customer.name = "";
      i.customFields[0]!.label = "";
    });
    expect(Object.keys(errors).sort()).toEqual(["business.name", "customFields.0.label", "customer.name"]);
    expect(errorsFor((i) => (i.lineItems = []))).toEqual({ lineItems: "Add at least one item" });
  });

  it("validates optional emails only when present", () => {
    expect(errorsFor((i) => (i.customer.email = "not-an-email"))).toHaveProperty("customer.email");
  });
});

describe("sendInvoiceSchema", () => {
  it("rejects header injection in the subject", () => {
    const result = sendInvoiceSchema.safeParse({
      to: "ava@example.com",
      subject: "Invoice\r\nBcc: victim@example.com",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});
