import { LoaderCircle } from "lucide-react";
import { useLocation, useParams } from "react-router";
import { NotFoundPage } from "@/components/not-found-page";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api";
import { useInvoice, useInvoiceDefaults } from "@/lib/queries";
import type { Invoice } from "@invoice/shared";
import { blankInvoice, duplicateInvoice, toFormValues } from "../form-model";
import { InvoiceEditor } from "./invoice-editor";

export function InvoiceEditorPage() {
  const { invoiceId } = useParams();
  return invoiceId ? <ExistingInvoice id={invoiceId} /> : <NewInvoice />;
}

function NewInvoice() {
  const defaults = useInvoiceDefaults();
  const location = useLocation();
  const source = (location.state as { duplicateOf?: Invoice } | null)?.duplicateOf;

  if (defaults.isPending) return <Loading />;
  if (defaults.isError) return <LoadError error={defaults.error} retry={() => void defaults.refetch()} />;
  const initialValues = source ? duplicateInvoice(source, defaults.data) : blankInvoice(defaults.data);
  return <InvoiceEditor key={source?.id ?? "new"} invoice={null} initialValues={initialValues} duplicatedFrom={source?.number} />;
}

function ExistingInvoice({ id }: { id: string }) {
  const query = useInvoice(id);
  const location = useLocation();
  const openSend = (location.state as { openSend?: boolean } | null)?.openSend === true;

  if (query.isPending) return <Loading />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <NotFoundPage title="Invoice not found" message="It may have been deleted, or the link is wrong." />;
    }
    return <LoadError error={query.error} retry={() => void query.refetch()} />;
  }
  return <InvoiceEditor key={id} invoice={query.data} initialValues={toFormValues(query.data)} openSendOnMount={openSend} />;
}

function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center gap-2 py-24 text-ink-muted" role="status">
      <LoaderCircle aria-hidden className="size-5 animate-spin" />
      Loading invoice…
    </div>
  );
}

function LoadError({ error, retry }: { error: Error; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-24 text-center" role="alert">
      <h1 className="font-display text-2xl font-semibold">Couldn't load the invoice</h1>
      <p className="text-ink-muted">{error.message}</p>
      <Button variant="primary" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
