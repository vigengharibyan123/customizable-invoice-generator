import {
  ACCENT_COLORS,
  DEFAULT_ACCENT_COLOR,
  formatCents,
  formatDate,
  formatMoneyString,
  formatPercent,
  formatQuantity,
  paymentTermsLabel,
  type InvoiceTotals,
} from "@invoice/shared";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { InvoiceFormValues } from "../form-model";

interface InvoiceDocumentProps {
  invoice: InvoiceFormValues;
  totals: InvoiceTotals;
  className?: string;
}

/**
 * The invoice as the customer sees it — one component for the live preview and for printing.
 * Hidden custom fields are never rendered, so they can't leak into print or PDF.
 */
export function InvoiceDocument({ invoice, totals, className }: InvoiceDocumentProps) {
  const { business, customer } = invoice;
  const visibleFields = invoice.customFields.filter((field) => field.visible && (field.label || field.value));
  const businessContact = [business.email, business.phone].filter(Boolean).join("  ·  ");
  // The brand color re-points the accent tokens for everything inside the document.
  const accent = ACCENT_COLORS[invoice.accentColor ?? DEFAULT_ACCENT_COLOR];
  const brandStyle = { "--color-accent": accent.hex, "--color-accent-soft": accent.soft } as CSSProperties;

  return (
    <article
      aria-label={`Invoice ${invoice.number || ""}`.trim()}
      style={brandStyle}
      className={cn(
        "invoice-document flex min-h-[1056px] w-[816px] print:min-h-[10.9in] flex-col border-t-[6px] border-accent bg-white px-14 pt-12 pb-12 text-[13px] leading-relaxed text-ink",
        className,
      )}
    >
      {/* Letterhead */}
      <header className="flex items-start justify-between gap-8">
        <div className="flex min-w-0 items-start gap-4">
          <Monogram name={business.name} />
          <div className="min-w-0">
            <p className="font-display text-xl leading-tight font-semibold tracking-tight">
              {business.name || <Placeholder>Your business</Placeholder>}
            </p>
            {business.address && <p className="mt-1 whitespace-pre-line text-ink-muted">{business.address}</p>}
            {businessContact && <p className="mt-0.5 text-ink-muted">{businessContact}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-[34px] leading-none font-semibold tracking-tight text-accent">Invoice</p>
          <p className="mt-2 font-medium tabular text-ink-muted">
            {invoice.number ? `No. ${invoice.number}` : <Placeholder>No. —</Placeholder>}
          </p>
        </div>
      </header>

      <div className="mt-10 h-px bg-line" />

      {/* Parties and key facts */}
      <section className="mt-8 grid grid-cols-[1.35fr_1fr] gap-10">
        <div className="min-w-0">
          <Eyebrow>Billed to</Eyebrow>
          <p className="mt-2 text-[15px] font-semibold">
            {customer.name || <Placeholder>Customer name</Placeholder>}
          </p>
          {customer.address && <p className="mt-0.5 whitespace-pre-line text-ink-muted">{customer.address}</p>}
          {customer.email && <p className="mt-0.5 text-ink-muted">{customer.email}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 self-start">
          <Fact label="Issued">{formatDate(invoice.issueDate) || "—"}</Fact>
          <Fact label="Due">{formatDate(invoice.dueDate) || "—"}</Fact>
          <Fact label="Terms">{paymentTermsLabel(invoice.paymentTerms)}</Fact>
          <Fact label="Amount due">
            <span className="font-semibold text-accent">{formatCents(totals.totalCents)}</span>
          </Fact>
        </dl>
      </section>

      {visibleFields.length > 0 && (
        <dl className="avoid-break mt-8 grid grid-cols-3 gap-x-6 gap-y-3 rounded-lg bg-surface-muted px-5 py-4">
          {visibleFields.map((field) => (
            <Fact key={field.id} label={field.label || "Untitled"}>
              <span className="break-words">{field.value || "—"}</span>
            </Fact>
          ))}
        </dl>
      )}

      {/* Line items */}
      <table className="mt-10 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-ink/80 text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            <th scope="col" className="pb-2.5 font-semibold">
              Description
            </th>
            <th scope="col" className="w-20 pb-2.5 text-right font-semibold">
              Qty
            </th>
            <th scope="col" className="w-28 pb-2.5 text-right font-semibold">
              Rate
            </th>
            <th scope="col" className="w-32 pb-2.5 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, index) => (
            <tr key={item.id} className="border-b border-line align-top">
              <td className="py-3 pr-4 whitespace-pre-line">
                {item.description || <Placeholder>Item description</Placeholder>}
              </td>
              <td className="py-3 text-right tabular">{formatQuantity(item.quantity)}</td>
              <td className="py-3 text-right tabular">{formatMoneyString(item.unitPrice)}</td>
              <td className="py-3 text-right font-medium tabular">
                {formatCents(totals.lineAmountsCents[index] ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="avoid-break mt-6 flex justify-end">
        <dl className="w-72 tabular">
          <TotalRow label="Subtotal" value={formatCents(totals.subtotalCents)} />
          {totals.discountCents > 0 && (
            <TotalRow label="Discount" value={`−${formatCents(totals.discountCents)}`} />
          )}
          <TotalRow label={`Tax (${formatPercent(invoice.taxRate)})`} value={formatCents(totals.taxCents)} />
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-accent pt-3">
            <dt className="font-semibold">Total due</dt>
            <dd className="font-display text-2xl font-semibold tracking-tight">{formatCents(totals.totalCents)}</dd>
          </div>
        </dl>
      </div>

      {invoice.notes && (
        <section className="avoid-break mt-10 max-w-[70%]">
          <Eyebrow>Notes</Eyebrow>
          <p className="mt-2 whitespace-pre-line text-ink-muted">{invoice.notes}</p>
        </section>
      )}

      <footer className="mt-auto flex items-end justify-between gap-6 border-t border-line pt-5 text-[12px] text-ink-muted">
        <p className="font-display text-[15px] text-ink italic">Thank you for your business.</p>
        <p className="text-right">{[business.name, business.email].filter(Boolean).join("  ·  ")}</p>
      </footer>
    </article>
  );
}

function Monogram({ name }: { name: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter((word) => /^[A-Za-z0-9]/.test(word))
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join("") || "·";
  return (
    <div
      aria-hidden
      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent font-display text-base font-semibold tracking-wide text-white"
    >
      {initials}
    </div>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{children}</p>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold tracking-[0.08em] text-ink-muted uppercase">{label}</dt>
      <dd className="mt-1 font-medium tabular">{children}</dd>
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-ink-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Shown on screen while a field is empty; invisible on paper. */
function Placeholder({ children }: { children: ReactNode }) {
  return <span className="text-ink-subtle italic print:invisible">{children}</span>;
}
