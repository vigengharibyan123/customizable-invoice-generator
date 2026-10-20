import Big from "big.js";
import { parseDecimal } from "./money";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 });
const dateFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const longDateFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** 9900 → "$99.00" */
export function formatCents(cents: number): string {
  return usd.format(new Big(cents).div(100).toNumber());
}

/** "50" → "$50.00"; invalid input → "$0.00" */
export function formatMoneyString(value: string): string {
  const amount = parseDecimal(value);
  return usd.format(amount ? amount.toNumber() : 0);
}

/** "1.500" → "1.5", "1200" → "1,200" */
export function formatQuantity(value: string): string {
  const amount = parseDecimal(value);
  return amount ? quantityFormat.format(amount.toNumber()) : "0";
}

/** "8.875" → "8.875%" */
export function formatPercent(value: string): string {
  const amount = parseDecimal(value);
  return `${amount ? amount.toString() : "0"}%`;
}

/** "2026-10-20" → "Oct 20, 2026" */
export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : dateFormat.format(date);
}

/** "2026-10-20" → "October 20, 2026" */
export function formatLongDate(isoDate: string): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? "" : longDateFormat.format(date);
}
