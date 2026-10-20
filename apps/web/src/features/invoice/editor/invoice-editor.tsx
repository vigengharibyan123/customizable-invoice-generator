import { zodResolver } from "@hookform/resolvers/zod";
import {
  calculateLiveTotals,
  displayStatus,
  formatCents,
  formatDate,
  invoiceInputSchema,
  todayIsoDate,
  type Invoice,
  type InvoiceData,
} from "@invoice/shared";
import { ChevronLeft, Copy, Eye, LoaderCircle, Pencil, Printer, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { useDeleteInvoice, useSaveInvoice } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { toFormValues, type InvoiceFormValues } from "../form-model";
import { InvoiceDocument } from "../preview/invoice-document";
import { ScaledPreview } from "../preview/scaled-preview";
import { StatusBadge } from "../status-badge";
import { CustomFieldsSection } from "./custom-fields-section";
import { ErrorSummary } from "./error-summary";
import { LineItemsSection } from "./line-items-section";
import { AdjustmentsSection, BusinessSection, CustomerSection, DetailsSection, NotesSection } from "./sections";
import { SendInvoiceDialog } from "./send-invoice-dialog";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

interface InvoiceEditorProps {
  /** The saved invoice, or null while creating a new one. */
  invoice: Invoice | null;
  initialValues: InvoiceFormValues;
  /** Open the send dialog right away (after "Send" saved a brand-new invoice). */
  openSendOnMount?: boolean;
  /** Number of the invoice this new draft was copied from. */
  duplicatedFrom?: string;
}

export function InvoiceEditor({ invoice, initialValues, openSendOnMount = false, duplicatedFrom }: InvoiceEditorProps) {
  const navigate = useNavigate();
  const form = useForm<InvoiceFormValues, unknown, InvoiceData>({
    resolver: zodResolver(invoiceInputSchema),
    defaultValues: initialValues,
    mode: "onTouched",
  });
  const { isDirty, isSubmitting, errors, submitCount } = form.formState;
  const saveInvoice = useSaveInvoice();
  const guard = useUnsavedChangesGuard(isDirty);
  const [sendOpen, setSendOpen] = useState(openSendOnMount && invoice !== null);
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  /** Saves through the API; on failure shows the server's field errors in the form. */
  async function persist(data: InvoiceData): Promise<Invoice | null> {
    try {
      const saved = await saveInvoice.mutateAsync({ id: invoice?.id ?? null, data });
      form.reset(toFormValues(saved));
      return saved;
    } catch (error) {
      if (error instanceof ApiError) {
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          form.setError(path as FieldPath<InvoiceFormValues>, { type: "server", message });
        }
      }
      toast.error(error instanceof Error ? error.message : "Couldn't save the invoice.");
      return null;
    }
  }

  const onInvalid = () => {
    setMobileView("edit");
    toast.error("Some fields need attention", { description: "Fix the highlighted fields, then try again." });
  };

  const handleSave = form.handleSubmit(async (data) => {
    const saved = await persist(data);
    if (!saved) return;
    if (invoice) {
      toast.success("Changes saved");
    } else {
      toast.success(`Invoice ${saved.number} created`);
      guard.allowNextNavigation();
      navigate(`/invoices/${saved.id}`, { replace: true });
    }
  }, onInvalid);

  const handleSend = form.handleSubmit(async (data) => {
    if (invoice && !isDirty) return setSendOpen(true);
    const saved = await persist(data);
    if (!saved) return;
    if (invoice) return setSendOpen(true);
    guard.allowNextNavigation();
    navigate(`/invoices/${saved.id}`, { replace: true, state: { openSend: true } });
  }, onInvalid);

  // ⌘S / Ctrl+S saves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // The document title becomes the default file name in "Save as PDF".
  useEffect(() => {
    const original = document.title;
    const onBeforePrint = () => {
      const { number, customer } = form.getValues();
      document.title = ["Invoice", number, customer.name && `– ${customer.name}`].filter(Boolean).join(" ");
    };
    const onAfterPrint = () => (document.title = original);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [form]);

  const status = invoice ? displayStatus(invoice.status, invoice.dueDate, todayIsoDate()) : "draft";
  const busy = isSubmitting || saveInvoice.isPending;

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSave} noValidate className="flex flex-1 flex-col print:block" aria-label="Invoice editor">
        {/* Toolbar: sticky on desktop; on phones only the Edit/Preview switch stays pinned. */}
        <div className="z-20 border-b border-line bg-canvas/90 backdrop-blur-md lg:sticky lg:top-14 print:hidden">
          <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-ink-muted">
              <Link to="/invoices" aria-label="Back to invoices">
                <ChevronLeft aria-hidden />
                <span className="max-sm:sr-only">Invoices</span>
              </Link>
            </Button>
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h1 className="truncate font-display text-xl font-semibold tracking-tight">
                {invoice ? invoice.number : "New invoice"}
              </h1>
              <StatusBadge status={status} />
              <SaveState isDirty={isDirty} isSaved={invoice !== null} />
            </div>
            <div className="flex items-center gap-2">
              {invoice && (
                <Button
                  variant="ghost"
                  onClick={() => navigate("/invoices/new", { state: { duplicateOf: invoice } })}
                  aria-label="Duplicate invoice"
                  title="Start a new draft with the same customer and items"
                >
                  <Copy aria-hidden />
                  <span className="hidden xl:inline">Duplicate</span>
                </Button>
              )}
              <Button variant="secondary" onClick={() => window.print()} aria-label="Print or save as PDF">
                <Printer aria-hidden />
                <span className="hidden md:inline">Print / PDF</span>
              </Button>
              <Button variant="secondary" onClick={() => void handleSend()} disabled={busy} aria-label="Send invoice by email">
                <Send aria-hidden />
                <span className="hidden md:inline">Send</span>
              </Button>
              <Button type="submit" variant="primary" disabled={busy} aria-keyshortcuts="Control+S Meta+S">
                {busy && <LoaderCircle aria-hidden className="animate-spin" />}
                {invoice ? "Save" : "Create invoice"}
              </Button>
            </div>
          </div>
        </div>
        <div className="sticky top-14 z-20 border-b border-line bg-canvas/90 pt-3 backdrop-blur-md lg:hidden print:hidden">
          <MobileViewSwitch view={mobileView} onChange={setMobileView} />
        </div>

        {duplicatedFrom && (
          <div className="border-b border-line bg-surface-muted print:hidden" role="status">
            <p className="mx-auto max-w-[1440px] px-4 py-2.5 text-sm text-ink-muted sm:px-6">
              Copied from {duplicatedFrom} with a new number and today's date. Review it, then create the invoice.
            </p>
          </div>
        )}

        {invoice?.status === "sent" && invoice.sentAt && (
          <div className="border-b border-accent/15 bg-accent-soft/60 print:hidden" role="status">
            <p className="mx-auto max-w-[1440px] px-4 py-2.5 text-sm text-accent-ink sm:px-6">
              Sent on {formatDate(invoice.sentAt.slice(0, 10))}. Edits aren't emailed automatically — send it again after
              changing anything the customer should see.
            </p>
          </div>
        )}

        <div className="mx-auto grid w-full max-w-[1440px] flex-1 items-start gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)] print:block print:max-w-none print:p-0">
          <div className={cn("flex min-w-0 flex-col gap-5 print:hidden", mobileView === "preview" && "max-lg:hidden")}>
            {submitCount > 0 && Object.keys(errors).length > 0 && <ErrorSummary errors={errors} />}
            <CustomerSection />
            <DetailsSection />
            <LineItemsSection />
            <AdjustmentsSection />
            <CustomFieldsSection />
            <NotesSection />
            <BusinessSection />
            {invoice?.status === "draft" && (
              <DeleteDraft invoice={invoice} beforeLeave={guard.allowNextNavigation} />
            )}
          </div>

          <aside
            aria-label="Live invoice preview"
            className={cn(
              "min-w-0 lg:sticky lg:top-[8.5rem] lg:max-h-[calc(100dvh-9.5rem)] lg:overflow-y-auto lg:rounded-xl lg:p-1 print:!block print:static print:max-h-none print:overflow-visible print:p-0",
              mobileView === "edit" && "max-lg:hidden",
            )}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3 px-1 print:hidden">
              <h2 className="text-sm font-semibold">Live preview</h2>
              <p className="text-xs text-ink-muted">US Letter · updates as you type</p>
            </div>
            <LivePreview />
          </aside>
        </div>
      </form>

      <SendInvoiceDialog invoice={invoice} open={sendOpen} onOpenChange={setSendOpen} />
      {guard.dialog}
    </FormProvider>
  );
}

function LivePreview() {
  const values = useWatch<InvoiceFormValues>() as InvoiceFormValues;
  return (
    <ScaledPreview>
      <InvoiceDocument invoice={values} totals={calculateLiveTotals(values)} />
    </ScaledPreview>
  );
}

function SaveState({ isDirty, isSaved }: { isDirty: boolean; isSaved: boolean }) {
  if (!isDirty && isSaved) {
    return <span className="hidden text-xs text-ink-muted sm:inline">All changes saved</span>;
  }
  return (
    <span className="hidden items-center gap-1.5 text-xs text-warning sm:inline-flex">
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {isSaved ? "Unsaved changes" : "Not saved yet"}
    </span>
  );
}

function MobileViewSwitch({ view, onChange }: { view: "edit" | "preview"; onChange: (view: "edit" | "preview") => void }) {
  const values = useWatch<InvoiceFormValues>() as InvoiceFormValues;
  const total = calculateLiveTotals(values).totalCents;
  const option = (value: "edit" | "preview", label: string, Icon: typeof Eye) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => onChange(value)}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-colors",
        view === value ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink",
      )}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 pb-3 sm:px-6">
      <div className="flex flex-1 rounded-lg bg-ink/[0.06] p-1" role="group" aria-label="View">
        {option("edit", "Edit", Pencil)}
        {option("preview", "Preview", Eye)}
      </div>
      <p className="text-right text-xs leading-tight text-ink-muted">
        Total due
        <span className="block font-display text-base font-semibold text-ink tabular">{formatCents(total)}</span>
      </p>
    </div>
  );
}

function DeleteDraft({ invoice, beforeLeave }: { invoice: Invoice; beforeLeave: () => void }) {
  const navigate = useNavigate();
  const deleteInvoice = useDeleteInvoice();
  const [open, setOpen] = useState(false);

  const confirm = async () => {
    try {
      await deleteInvoice.mutateAsync(invoice.id);
      beforeLeave();
      toast.success(`Draft ${invoice.number} deleted`);
      navigate("/invoices", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the draft.");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-line-strong px-5 py-4">
      <p className="text-sm text-ink-muted">Drafts can be deleted. Sent invoices are kept for your records.</p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden />
        Delete draft
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title={`Delete draft ${invoice.number}?`} description="This permanently removes the draft. It can't be undone." />
          <DialogFooter>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" className="bg-danger hover:bg-danger/90" onClick={() => void confirm()} disabled={deleteInvoice.isPending}>
              Delete draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
