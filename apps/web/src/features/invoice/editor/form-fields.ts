import type { ChangeEvent } from "react";
import { get, useFormContext, type FieldPath } from "react-hook-form";
import { sanitizeDecimalInput } from "@/lib/utils";
import type { InvoiceFormValues } from "../form-model";

export type InvoicePath = FieldPath<InvoiceFormValues>;

/** Typed access to the editor form plus small helpers shared by every section. */
export function useInvoiceForm() {
  const form = useFormContext<InvoiceFormValues>();

  const errorFor = (path: InvoicePath): string | undefined =>
    get(form.formState.errors, path)?.message as string | undefined;

  /** Registers a money/quantity input: numeric keyboard on phones, and no minus sign or letters. */
  const registerDecimal = (path: InvoicePath) => {
    const field = form.register(path);
    return {
      ...field,
      inputMode: "decimal" as const,
      autoComplete: "off",
      onChange: (event: ChangeEvent<HTMLInputElement>) => {
        const clean = sanitizeDecimalInput(event.target.value);
        if (clean !== event.target.value) event.target.value = clean;
        return field.onChange(event);
      },
    };
  };

  return { ...form, errorFor, registerDecimal };
}
