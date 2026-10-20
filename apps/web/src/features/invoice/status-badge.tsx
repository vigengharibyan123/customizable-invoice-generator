import type { DisplayStatus } from "@invoice/shared";
import { cn } from "@/lib/utils";

const styles: Record<DisplayStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-ink/[0.06] text-ink-muted ring-ink/10" },
  sent: { label: "Sent", className: "bg-accent-soft text-accent-ink ring-accent/20" },
  overdue: { label: "Overdue", className: "bg-warning-soft text-warning ring-warning/20" },
};

export function StatusBadge({ status, className }: { status: DisplayStatus; className?: string }) {
  const { label, className: tone } = styles[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone,
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
