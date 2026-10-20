import {
  formatCents,
  formatDate,
  formatMoneyString,
  formatPercent,
  formatQuantity,
  paymentTermsLabel,
  type Invoice,
} from "@invoice/shared";

/** The plain-text alternative, written for people (and spam filters) rather than stripped HTML. */
export function renderInvoiceText(invoice: Invoice, personalMessage: string): string {
  const { business, customer, totals } = invoice;
  const contact = [business.email, business.phone].filter(Boolean).join(" · ");

  const blocks: string[][] = [
    [business.name, `Invoice ${invoice.number}`],
    [`Amount due: ${formatCents(totals.totalCents)}`, `Due: ${formatDate(invoice.dueDate)}`],
    personalMessage ? [personalMessage] : [],
    ["Bill to:", customer.name, customer.email, customer.address].filter(Boolean),
    [
      `Issued: ${formatDate(invoice.issueDate)}`,
      `Due: ${formatDate(invoice.dueDate)}`,
      invoice.paymentTerms === "custom" ? "" : `Terms: ${paymentTermsLabel(invoice.paymentTerms)}`,
    ].filter(Boolean),
    [
      "Items:",
      ...invoice.lineItems.map(
        (item, index) =>
          `- ${item.description}: ${formatQuantity(item.quantity)} × ${formatMoneyString(item.unitPrice)} = ${formatCents(totals.lineAmountsCents[index])}`,
      ),
    ],
    [
      `Subtotal: ${formatCents(totals.subtotalCents)}`,
      totals.discountCents > 0 ? `Discount: −${formatCents(totals.discountCents)}` : "",
      `Tax (${formatPercent(invoice.taxRate)}): ${formatCents(totals.taxCents)}`,
      `Total: ${formatCents(totals.totalCents)}`,
    ].filter(Boolean),
    invoice.customFields
      .filter((field) => field.visible)
      .map((field) => `${field.label}: ${field.value}`),
    invoice.notes ? ["Notes:", invoice.notes] : [],
    ["--", business.name, business.address, contact].filter(Boolean),
  ];

  return `${blocks
    .filter((block) => block.length > 0)
    .map((block) => block.join("\n"))
    .join("\n\n")}\n`;
}
