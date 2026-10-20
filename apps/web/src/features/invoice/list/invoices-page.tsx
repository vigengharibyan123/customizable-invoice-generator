import { displayStatus, formatCents, formatDate, todayIsoDate, type InvoiceSummary } from "@invoice/shared";
import { FileText, LoaderCircle, Plus } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useInvoices } from "@/lib/queries";
import { StatusBadge } from "../status-badge";

export function InvoicesPage() {
  const query = useInvoices();
  const today = todayIsoDate();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Invoices</h1>
          <p className="mt-1.5 text-ink-muted">Create, send and keep track of what you're owed.</p>
        </div>
        <Button asChild variant="primary" size="lg">
          <Link to="/invoices/new">
            <Plus aria-hidden />
            New invoice
          </Link>
        </Button>
      </div>

      {query.isPending && (
        <div className="flex items-center gap-2 py-16 text-ink-muted" role="status">
          <LoaderCircle aria-hidden className="size-5 animate-spin" /> Loading invoices…
        </div>
      )}
      {query.isError && (
        <Card className="p-6" role="alert">
          <p className="font-medium">Couldn't load invoices.</p>
          <p className="mt-1 text-sm text-ink-muted">{query.error.message}</p>
          <Button className="mt-4" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </Card>
      )}
      {query.isSuccess &&
        (query.data.length === 0 ? <EmptyState /> : <InvoiceOverview invoices={query.data} today={today} />)}
    </div>
  );
}

function InvoiceOverview({ invoices, today }: { invoices: InvoiceSummary[]; today: string }) {
  const rows = invoices.map((invoice) => ({ ...invoice, display: displayStatus(invoice.status, invoice.dueDate, today) }));
  const outstanding = rows.filter((row) => row.display !== "draft");
  const overdue = rows.filter((row) => row.display === "overdue");
  const drafts = rows.filter((row) => row.display === "draft");
  const sum = (list: typeof rows) => formatCents(list.reduce((total, row) => total + row.totalCents, 0));

  return (
    <>
      <dl className="grid grid-cols-3 gap-2 sm:gap-4">
        <Stat label="Outstanding" value={sum(outstanding)} detail={`${outstanding.length} sent ${outstanding.length === 1 ? "invoice" : "invoices"}`} />
        <Stat label="Overdue" value={sum(overdue)} detail={`${overdue.length} past due`} tone={overdue.length ? "warning" : undefined} />
        <Stat label="Drafts" value={String(drafts.length)} detail={`${sum(drafts)} not yet sent`} />
      </dl>

      <Card className="overflow-hidden">
        <h2 className="sr-only">All invoices</h2>
        {/* Desktop table */}
        <table className="hidden w-full text-left text-sm md:table">
          <thead className="border-b border-line bg-surface-muted text-xs tracking-wide text-ink-muted uppercase">
            <tr>
              <th scope="col" className="px-6 py-3 font-medium">Invoice</th>
              <th scope="col" className="px-6 py-3 font-medium">Customer</th>
              <th scope="col" className="px-6 py-3 font-medium">Issued</th>
              <th scope="col" className="px-6 py-3 font-medium">Due</th>
              <th scope="col" className="px-6 py-3 font-medium">Status</th>
              <th scope="col" className="px-6 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={row.id} className="group relative transition-colors hover:bg-surface-muted">
                <td className="px-6 py-4 font-medium tabular">
                  {/* The whole row is clickable; the link itself carries the accessible name. */}
                  <Link to={`/invoices/${row.id}`} className="rounded-sm after:absolute after:inset-0 group-hover:text-accent">
                    {row.number}
                  </Link>
                </td>
                <td className="max-w-64 truncate px-6 py-4">{row.customerName}</td>
                <td className="px-6 py-4 text-ink-muted tabular">{formatDate(row.issueDate)}</td>
                <td className="px-6 py-4 text-ink-muted tabular">{formatDate(row.dueDate)}</td>
                <td className="px-6 py-4"><StatusBadge status={row.display} /></td>
                <td className="px-6 py-4 text-right font-medium tabular">{formatCents(row.totalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile list */}
        <ul className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              <Link to={`/invoices/${row.id}`} className="flex flex-col gap-1.5 px-4 py-4 hover:bg-surface-muted">
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium tabular">{row.number}</span>
                  <span className="font-medium tabular">{formatCents(row.totalCents)}</span>
                </span>
                <span className="flex items-center justify-between gap-3 text-sm text-ink-muted">
                  <span className="truncate">{row.customerName}</span>
                  <StatusBadge status={row.display} />
                </span>
                <span className="text-xs text-ink-muted tabular">Due {formatDate(row.dueDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "warning" }) {
  return (
    <Card className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
      <dt className="text-xs text-ink-muted sm:text-sm">{label}</dt>
      <dd className={`mt-1 truncate font-display text-base font-semibold tabular sm:text-2xl ${tone === "warning" ? "text-warning" : ""}`}>
        {value}
      </dd>
      <dd className="mt-0.5 hidden text-xs text-ink-muted sm:block">{detail}</dd>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <FileText aria-hidden className="size-6" />
      </span>
      <h2 className="font-display text-xl font-semibold">No invoices yet</h2>
      <p className="max-w-sm text-ink-muted">Create your first invoice — it takes about a minute, and you can preview it as you type.</p>
      <Button asChild variant="primary" className="mt-2">
        <Link to="/invoices/new">
          <Plus aria-hidden /> New invoice
        </Link>
      </Button>
    </Card>
  );
}
