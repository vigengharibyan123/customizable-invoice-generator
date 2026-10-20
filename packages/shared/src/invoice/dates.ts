/**
 * Invoice dates are calendar dates ("2026-10-20"), not timestamps, so they never shift
 * between time zones. All arithmetic is done in UTC on purpose.
 */
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Today's date in the user's local time zone (what "today" means to the person issuing). */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromIsoDate: string, toIsoDate: string): number {
  const from = Date.parse(`${fromIsoDate}T00:00:00Z`);
  const to = Date.parse(`${toIsoDate}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

export const PAYMENT_TERMS = ["due_on_receipt", "net_15", "net_30", "net_60", "custom"] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const PAYMENT_TERM_OPTIONS: ReadonlyArray<{
  value: PaymentTerms;
  label: string;
  days: number | null;
}> = [
  { value: "due_on_receipt", label: "Due on receipt", days: 0 },
  { value: "net_15", label: "Net 15", days: 15 },
  { value: "net_30", label: "Net 30", days: 30 },
  { value: "net_60", label: "Net 60", days: 60 },
  { value: "custom", label: "Custom", days: null },
];

export function paymentTermsLabel(terms: PaymentTerms): string {
  return PAYMENT_TERM_OPTIONS.find((option) => option.value === terms)?.label ?? "Custom";
}

/** Due date implied by the payment terms, or null for custom terms. */
export function dueDateForTerms(issueDate: string, terms: PaymentTerms): string | null {
  const days = PAYMENT_TERM_OPTIONS.find((option) => option.value === terms)?.days;
  return days == null ? null : addDays(issueDate, days);
}

/** Infers the payment terms from two dates, e.g. a 30-day gap is "Net 30". */
export function paymentTermsForDates(issueDate: string, dueDate: string): PaymentTerms {
  const gap = daysBetween(issueDate, dueDate);
  return PAYMENT_TERM_OPTIONS.find((option) => option.days === gap)?.value ?? "custom";
}
