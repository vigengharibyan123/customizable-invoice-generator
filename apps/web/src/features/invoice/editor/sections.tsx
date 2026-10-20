import {
  calculateLiveTotals,
  dueDateForTerms,
  formatCents,
  PAYMENT_TERM_OPTIONS,
  paymentTermsForDates,
  type PaymentTerms,
} from "@invoice/shared";
import { useWatch } from "react-hook-form";
import { SectionCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { AffixInput, Input, Select, Textarea } from "@/components/ui/input";
import type { InvoiceFormValues } from "../form-model";
import { useInvoiceForm } from "./form-fields";

export function CustomerSection() {
  const { register, errorFor } = useInvoiceForm();
  return (
    <SectionCard title="Bill to" description="Who is paying this invoice." headingId="section-customer">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="customer.name" label="Customer or company" error={errorFor("customer.name")}>
          {(a11y) => <Input {...a11y} {...register("customer.name")} autoComplete="organization" />}
        </Field>
        <Field
          name="customer.email"
          label="Email"
          optional
          error={errorFor("customer.email")}
          hint="Used when you send the invoice."
        >
          {(a11y) => <Input {...a11y} {...register("customer.email")} type="email" autoComplete="email" />}
        </Field>
        <Field name="customer.address" label="Billing address" optional className="sm:col-span-2" error={errorFor("customer.address")}>
          {(a11y) => <Textarea {...a11y} {...register("customer.address")} rows={2} autoComplete="street-address" />}
        </Field>
      </div>
    </SectionCard>
  );
}

export function DetailsSection() {
  const { register, errorFor, setValue, getValues } = useInvoiceForm();
  const options = { shouldDirty: true, shouldValidate: true } as const;

  // Payment terms and dates stay in sync: picking terms moves the due date, and editing the
  // due date by hand switches the terms to whatever the gap now is (or "Custom").
  const issueDate = register("issueDate", {
    onChange: () => {
      const due = dueDateForTerms(getValues("issueDate"), getValues("paymentTerms"));
      if (due) setValue("dueDate", due, options);
    },
  });
  const paymentTerms = register("paymentTerms", {
    onChange: () => {
      const due = dueDateForTerms(getValues("issueDate"), getValues("paymentTerms"));
      if (due) setValue("dueDate", due, options);
    },
  });
  const dueDate = register("dueDate", {
    onChange: () => setValue("paymentTerms", paymentTermsForDates(getValues("issueDate"), getValues("dueDate")), options),
  });

  return (
    <SectionCard title="Invoice details" headingId="section-details">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="number" label="Invoice number" error={errorFor("number")} hint="Numbers run in sequence; edit if you need to.">
          {(a11y) => <Input {...a11y} {...register("number")} className="tabular" autoComplete="off" />}
        </Field>
        <Field name="paymentTerms" label="Payment terms" error={errorFor("paymentTerms")}>
          {(a11y) => (
            <Select {...a11y} {...paymentTerms}>
              {PAYMENT_TERM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value satisfies PaymentTerms}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field name="issueDate" label="Issue date" error={errorFor("issueDate")}>
          {(a11y) => <Input {...a11y} {...issueDate} type="date" className="tabular" />}
        </Field>
        <Field name="dueDate" label="Due date" error={errorFor("dueDate")}>
          {(a11y) => <Input {...a11y} {...dueDate} type="date" className="tabular" />}
        </Field>
      </div>
    </SectionCard>
  );
}

export function AdjustmentsSection() {
  const { registerDecimal, errorFor, control } = useInvoiceForm();
  const [lineItems, discount, taxRate] = useWatch<InvoiceFormValues, ["lineItems", "discount", "taxRate"]>({
    control,
    name: ["lineItems", "discount", "taxRate"],
  });
  const totals = calculateLiveTotals({ lineItems, discount, taxRate });

  return (
    <SectionCard
      title="Discount & tax"
      description="The discount is a fixed amount taken off before tax."
      headingId="section-adjustments"
    >
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Field name="discount" label="Discount" error={errorFor("discount")} hint="Can't exceed the subtotal.">
            {(a11y) => <AffixInput {...a11y} {...registerDecimal("discount")} prefix="$" placeholder="0.00" />}
          </Field>
          <Field name="taxRate" label="Tax rate" error={errorFor("taxRate")} hint="Applied after the discount, e.g. 8.875.">
            {(a11y) => <AffixInput {...a11y} {...registerDecimal("taxRate")} suffix="%" placeholder="0" />}
          </Field>
        </div>
        <dl className="flex flex-col gap-2 self-start rounded-xl bg-surface-muted p-4 text-sm tabular" aria-label="Totals">
          <SummaryRow label="Subtotal" value={formatCents(totals.subtotalCents)} />
          <SummaryRow label="Discount" value={totals.discountCents ? `−${formatCents(totals.discountCents)}` : formatCents(0)} />
          <SummaryRow label="Tax" value={formatCents(totals.taxCents)} />
          <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3">
            <dt className="font-medium">Total due</dt>
            <dd className="font-display text-xl font-semibold" aria-live="polite">
              {formatCents(totals.totalCents)}
            </dd>
          </div>
        </dl>
      </div>
    </SectionCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-ink-muted">
      <dt>{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function NotesSection() {
  const { register, errorFor } = useInvoiceForm();
  return (
    <SectionCard title="Notes" headingId="section-notes">
      <Field
        name="notes"
        label="Notes for the customer"
        optional
        error={errorFor("notes")}
        hint="Payment instructions, a thank-you note or terms. Printed at the bottom of the invoice."
      >
        {(a11y) => <Textarea {...a11y} {...register("notes")} rows={3} />}
      </Field>
    </SectionCard>
  );
}

export function BusinessSection() {
  const { register, errorFor } = useInvoiceForm();
  return (
    <SectionCard
      title="Your business"
      description="Printed in the invoice letterhead. New invoices reuse your latest details."
      headingId="section-business"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="business.name" label="Business name" error={errorFor("business.name")}>
          {(a11y) => <Input {...a11y} {...register("business.name")} autoComplete="organization" />}
        </Field>
        <Field name="business.email" label="Email" optional error={errorFor("business.email")} hint="Customer replies go here.">
          {(a11y) => <Input {...a11y} {...register("business.email")} type="email" autoComplete="email" />}
        </Field>
        <Field name="business.phone" label="Phone" optional error={errorFor("business.phone")}>
          {(a11y) => <Input {...a11y} {...register("business.phone")} type="tel" autoComplete="tel" />}
        </Field>
        <Field name="business.address" label="Address" optional error={errorFor("business.address")}>
          {(a11y) => <Textarea {...a11y} {...register("business.address")} rows={2} autoComplete="street-address" />}
        </Field>
      </div>
    </SectionCard>
  );
}
