import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FieldErrors } from "react-hook-form";
import { fieldId } from "@/lib/utils";
import type { InvoiceFormValues } from "../form-model";

const LABELS: Record<string, string> = {
  number: "Invoice number",
  issueDate: "Issue date",
  dueDate: "Due date",
  paymentTerms: "Payment terms",
  "business.name": "Business name",
  "business.email": "Business email",
  "business.phone": "Business phone",
  "business.address": "Business address",
  "customer.name": "Customer name",
  "customer.email": "Customer email",
  "customer.address": "Billing address",
  discount: "Discount",
  taxRate: "Tax rate",
  notes: "Notes",
  lineItems: "Items",
};

function describe(path: string): string {
  const item = /^lineItems\.(\d+)\.(\w+)$/.exec(path);
  if (item) return `Item ${Number(item[1]) + 1} ${{ unitPrice: "price" }[item[2]!] ?? item[2]}`;
  const custom = /^customFields\.(\d+)\.(\w+)$/.exec(path);
  if (custom) return `Custom field ${Number(custom[1]) + 1} ${custom[2]}`;
  return LABELS[path] ?? path;
}

/** Flattens react-hook-form's nested errors into [path, message] pairs, in form order. */
function flatten(errors: FieldErrors, prefix = ""): Array<[string, string]> {
  return Object.entries(errors).flatMap(([key, value]): Array<[string, string]> => {
    if (!value || typeof value !== "object") return [];
    const path = key === "root" ? prefix : prefix ? `${prefix}.${key}` : key;
    if ("message" in value && typeof value.message === "string" && "type" in value) {
      return [[path, value.message]];
    }
    return flatten(value as FieldErrors, path);
  });
}

/** Lists every problem after a failed save, with links that move focus to the field. */
export function ErrorSummary({ errors }: { errors: FieldErrors<InvoiceFormValues> }) {
  const ref = useRef<HTMLDivElement>(null);
  const items = flatten(errors);

  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  if (items.length === 0) return null;

  return (
    <div ref={ref} role="alert" className="rounded-2xl border border-danger/30 bg-danger-soft p-5" aria-labelledby="error-summary-title">
      <h2 id="error-summary-title" className="flex items-center gap-2 font-semibold text-danger">
        <CircleAlert aria-hidden className="size-5" />
        {items.length === 1 ? "1 thing needs fixing" : `${items.length} things need fixing`} before saving
      </h2>
      <ul className="mt-3 flex flex-col gap-1.5 pl-7 text-sm">
        {items.map(([path, message]) => (
          <li key={path}>
            <a
              href={`#${fieldId(path)}`}
              className="text-danger underline underline-offset-2 hover:no-underline"
              onClick={(event) => {
                const target = document.getElementById(fieldId(path)) ?? document.getElementById("add-line-item");
                if (!target) return;
                event.preventDefault();
                target.focus();
                target.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
            >
              {describe(path)}: {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
