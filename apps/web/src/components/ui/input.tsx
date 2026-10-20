import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlStyles =
  "w-full rounded-lg border border-line-strong bg-surface text-sm text-ink shadow-card transition-colors placeholder:text-ink-subtle hover:border-ink/35 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent/30 disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:outline-danger/25";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlStyles, "h-10 px-3", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(controlStyles, "min-h-20 resize-y px-3 py-2 leading-relaxed", className)} {...props} />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        controlStyles,
        "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 fill=%22none%22 stroke=%22%235f594f%22 stroke-width=%222%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_0.75rem_center] bg-no-repeat pr-9 pl-3",
        className,
      )}
      {...props}
    />
  );
}

/** Input with a fixed prefix ("$") or suffix ("%") that stays outside the typed value. */
export function AffixInput({
  prefix,
  suffix,
  className,
  ...props
}: ComponentProps<"input"> & { prefix?: ReactNode; suffix?: ReactNode }) {
  return (
    <div className="relative">
      {prefix && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-ink-muted">
          {prefix}
        </span>
      )}
      <Input className={cn("tabular", prefix && "pl-7", suffix && "pr-8", className)} {...props} />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}
