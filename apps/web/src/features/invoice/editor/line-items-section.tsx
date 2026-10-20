import { calculateLiveTotals, formatCents } from "@invoice/shared";
import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { AffixInput, Input } from "@/components/ui/input";
import { fieldId } from "@/lib/utils";
import { newLineItem, type InvoiceFormValues } from "../form-model";
import { useInvoiceForm } from "./form-fields";

const ROW_GRID = "sm:grid-cols-[minmax(0,1fr)_5.5rem_7.5rem_6.5rem_2.5rem]";

export function LineItemsSection() {
  const { control, errorFor } = useInvoiceForm();
  const { fields, append, remove } = useFieldArray({ control, name: "lineItems", keyName: "key" });
  const listError = errorFor("lineItems") ?? errorFor("lineItems.root" as "lineItems");

  const removeItem = (index: number) => {
    remove(index);
    // Keep keyboard users in place: focus the row that moved up, or the "Add item" button.
    requestAnimationFrame(() => {
      const next = document.getElementById(fieldId(`lineItems.${Math.max(0, index - 1)}.description`));
      (next ?? document.getElementById("add-line-item"))?.focus();
    });
  };

  return (
    <SectionCard title="Items" description="Products or services, with quantity and unit price in USD." headingId="section-items">
      <div className={`hidden gap-3 border-b border-line pb-2 text-xs font-medium tracking-wide text-ink-muted uppercase sm:grid ${ROW_GRID}`} aria-hidden>
        <span>Description</span>
        <span className="text-right">Qty</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span />
      </div>

      <ol className="flex flex-col" aria-label="Line items">
        {fields.map((field, index) => (
          <LineItemRow key={field.key} index={index} canRemove={fields.length > 1} onRemove={() => removeItem(index)} />
        ))}
      </ol>

      {listError && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {listError}
        </p>
      )}

      <Button
        id="add-line-item"
        variant="ghost"
        className="mt-3 w-full border border-dashed border-line-strong text-ink-muted hover:border-accent hover:text-accent"
        onClick={() =>
          append(newLineItem(), { shouldFocus: true, focusName: `lineItems.${fields.length}.description` })
        }
      >
        <Plus aria-hidden />
        Add item
      </Button>
    </SectionCard>
  );
}

function LineItemRow({ index, canRemove, onRemove }: { index: number; canRemove: boolean; onRemove: () => void }) {
  const { register, registerDecimal, errorFor, control } = useInvoiceForm();
  const [quantity, unitPrice] = useWatch<InvoiceFormValues, [`lineItems.${number}.quantity`, `lineItems.${number}.unitPrice`]>({
    control,
    name: [`lineItems.${index}.quantity`, `lineItems.${index}.unitPrice`],
  });
  const amount = calculateLiveTotals({ lineItems: [{ quantity, unitPrice }], discount: "0", taxRate: "0" }).subtotalCents;
  const itemLabel = <span className="sr-only">Item {index + 1} </span>;

  return (
    <li className={`grid grid-cols-2 items-start gap-x-3 gap-y-3 border-b border-line py-4 last:border-b-0 sm:py-3 ${ROW_GRID}`}>
      <Field
        name={`lineItems.${index}.description`}
        label={<>{itemLabel}Description</>}
        labelClassName="sm:sr-only"
        error={errorFor(`lineItems.${index}.description`)}
        className="col-span-2 sm:col-span-1"
      >
        {(a11y) => <Input {...a11y} {...register(`lineItems.${index}.description`)} placeholder="e.g. Website design" />}
      </Field>
      <Field
        name={`lineItems.${index}.quantity`}
        label={<>{itemLabel}Quantity</>}
        labelClassName="sm:sr-only"
        error={errorFor(`lineItems.${index}.quantity`)}
      >
        {(a11y) => <Input {...a11y} {...registerDecimal(`lineItems.${index}.quantity`)} className="tabular sm:text-right" />}
      </Field>
      <Field
        name={`lineItems.${index}.unitPrice`}
        label={<>{itemLabel}Price</>}
        labelClassName="sm:sr-only"
        error={errorFor(`lineItems.${index}.unitPrice`)}
      >
        {(a11y) => (
          <AffixInput {...a11y} {...registerDecimal(`lineItems.${index}.unitPrice`)} prefix="$" placeholder="0.00" className="sm:text-right" />
        )}
      </Field>
      <p className="flex h-10 items-center text-sm font-medium tabular sm:justify-end">
        <span className="mr-2 text-ink-muted sm:sr-only">Amount</span>
        {formatCents(amount)}
      </p>
      <div className="flex h-10 items-center justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-ink-muted hover:bg-danger-soft hover:text-danger"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`Remove item ${index + 1}`}
          title={canRemove ? `Remove item ${index + 1}` : "An invoice needs at least one item"}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
