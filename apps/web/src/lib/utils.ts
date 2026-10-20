import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Random id for new rows. `crypto.randomUUID` is unavailable on plain-http LAN URLs. */
export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Keeps only digits and the first decimal point, so a minus sign can never be typed. */
export function sanitizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  return firstDot === -1
    ? cleaned
    : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

/** Stable DOM id for a form field path, used by labels and the error summary. */
export function fieldId(path: string): string {
  return `field-${path.replace(/\./g, "-")}`;
}
