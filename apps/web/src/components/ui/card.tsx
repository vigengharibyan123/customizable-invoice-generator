import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("rounded-2xl border border-line bg-surface shadow-card", className)} {...props} />;
}

/** Form section: a card with a heading, optional description and header action. */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  headingId,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headingId: string;
}) {
  return (
    <Card aria-labelledby={headingId} className={cn("p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="text-sm leading-relaxed text-ink-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}
