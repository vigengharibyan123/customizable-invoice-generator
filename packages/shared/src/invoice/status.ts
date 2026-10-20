import type { InvoiceStatus } from "./schema";

export type DisplayStatus = "draft" | "sent" | "overdue";

/** "Overdue" is derived, never stored: a sent invoice whose due date has passed. */
export function displayStatus(status: InvoiceStatus, dueDate: string, today: string): DisplayStatus {
  if (status === "sent" && dueDate < today) return "overdue";
  return status;
}

/**
 * Suggests the next sequential invoice number ("INV-0007" after "INV-0006").
 * Numbers that don't follow the INV-#### pattern are ignored.
 */
export function nextInvoiceNumber(existingNumbers: readonly string[]): string {
  const highest = existingNumbers.reduce((max, number) => {
    const match = /^INV-(\d+)$/i.exec(number.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `INV-${String(highest + 1).padStart(4, "0")}`;
}
