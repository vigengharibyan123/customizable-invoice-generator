import { EyeOff, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn, fieldId } from "@/lib/utils";
import { newCustomField, type InvoiceFormValues } from "../form-model";
import { useInvoiceForm } from "./form-fields";

const SUGGESTIONS = ["PO Number", "Project", "Tax ID", "Reference"];

export function CustomFieldsSection() {
  const { control } = useInvoiceForm();
  const { fields, append, remove } = useFieldArray({ control, name: "customFields", keyName: "key" });

  const add = (label = "") =>
    append(newCustomField(label), {
      shouldFocus: true,
      focusName: `customFields.${fields.length}.${label ? "value" : "label"}`,
    });

  const removeField = (index: number) => {
    remove(index);
    requestAnimationFrame(() => {
      const next = document.getElementById(fieldId(`customFields.${Math.max(0, index - 1)}.label`));
      (next ?? document.getElementById("add-custom-field"))?.focus();
    });
  };

  return (
    <SectionCard
      title="Custom fields"
      description="Extra details like a PO number. Visible fields print on the invoice; hidden ones stay private. They never change the totals."
      headingId="section-custom-fields"
    >
      {fields.length > 0 && (
        <ol className="flex flex-col gap-3" aria-label="Custom fields">
          {fields.map((field, index) => (
            <CustomFieldRow key={field.key} index={index} onRemove={() => removeField(index)} />
          ))}
        </ol>
      )}

      {fields.length === 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-muted">Quick add:</span>
          {SUGGESTIONS.map((label) => (
            <Button key={label} size="sm" variant="secondary" onClick={() => add(label)}>
              <Plus aria-hidden />
              {label}
            </Button>
          ))}
        </div>
      )}

      <Button
        id="add-custom-field"
        variant="ghost"
        className="mt-3 w-full border border-dashed border-line-strong text-ink-muted hover:border-accent hover:text-accent"
        onClick={() => add()}
      >
        <Plus aria-hidden />
        Add custom field
      </Button>
    </SectionCard>
  );
}

function CustomFieldRow({ index, onRemove }: { index: number; onRemove: () => void }) {
  const { register, errorFor, control } = useInvoiceForm();
  const [label, visible] = useWatch<InvoiceFormValues, [`customFields.${number}.label`, `customFields.${number}.visible`]>({
    control,
    name: [`customFields.${index}.label`, `customFields.${index}.visible`],
  });
  const name = label.trim() || `custom field ${index + 1}`;

  return (
    <li
      className={cn(
        "grid grid-cols-1 gap-3 rounded-xl border border-line p-3 transition-colors sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] sm:items-start",
        !visible && "border-dashed bg-surface-muted",
      )}
    >
      <Field name={`customFields.${index}.label`} label="Label" error={errorFor(`customFields.${index}.label`)}>
        {(a11y) => <Input {...a11y} {...register(`customFields.${index}.label`)} placeholder="e.g. PO Number" />}
      </Field>
      <Field name={`customFields.${index}.value`} label="Value" error={errorFor(`customFields.${index}.value`)}>
        {(a11y) => <Input {...a11y} {...register(`customFields.${index}.value`)} placeholder="e.g. HP-2291" />}
      </Field>
      <div className="flex items-center justify-between gap-3 sm:h-full sm:flex-col sm:items-end sm:justify-start sm:pt-7">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name={`customFields.${index}.visible`}
            render={({ field }) => (
              <Switch
                id={fieldId(`customFields.${index}.visible`)}
                checked={field.value}
                onCheckedChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
                aria-label={`Show ${name} on the invoice`}
              />
            )}
          />
          <span className={cn("flex items-center gap-1 text-[0.8125rem]", visible ? "text-ink" : "text-ink-muted")} aria-hidden>
            {visible ? "Shown" : (
              <>
                <EyeOff className="size-3.5" /> Hidden
              </>
            )}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-ink-muted hover:bg-danger-soft hover:text-danger"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          title={`Remove ${name}`}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
    </li>
  );
}
