import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn, fieldId } from "@/lib/utils";

export interface ControlProps {
  id: string;
  "aria-invalid": boolean;
  "aria-describedby": string | undefined;
}

interface FieldProps {
  /** Form path, e.g. "customer.email" — becomes the stable element id. */
  name: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  /** Extra label classes, e.g. "sm:sr-only" in table-like rows that have a visual header. */
  labelClassName?: string;
  className?: string;
  children: (control: ControlProps) => ReactNode;
}

/** Label + control + hint + error, wired together for assistive technology. */
export function Field({ name, label, error, hint, optional, labelClassName, className, children }: FieldProps) {
  const id = fieldId(name);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={cn("text-[0.8125rem] font-medium text-ink", labelClassName)}>
        {label}
        {optional && <span className="ml-1.5 font-normal text-ink-muted">(optional)</span>}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-[0.8125rem] leading-snug text-danger">
          <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="text-[0.8125rem] leading-snug text-ink-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
