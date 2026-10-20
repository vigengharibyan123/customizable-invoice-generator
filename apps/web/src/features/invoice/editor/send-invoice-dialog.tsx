import { zodResolver } from "@hookform/resolvers/zod";
import {
  formatCents,
  formatLongDate,
  sendInvoiceSchema,
  type Invoice,
  type SendInvoiceInput,
} from "@invoice/shared";
import { CircleAlert, LoaderCircle, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { useSendInvoice } from "@/lib/queries";

interface SendInvoiceDialogProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendInvoiceDialog({ invoice, open, onOpenChange }: SendInvoiceDialogProps) {
  if (!invoice) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Remount per version so the prefilled text matches the saved invoice. */}
        <SendInvoiceForm key={invoice.updatedAt} invoice={invoice} onSent={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function defaultMessage(invoice: Invoice): string {
  return [
    `Hi ${invoice.customer.name},`,
    "",
    `Here's invoice ${invoice.number} for ${formatCents(invoice.totals.totalCents)}, due ${formatLongDate(invoice.dueDate)}.`,
    "",
    "Thank you for your business!",
    invoice.business.name,
  ].join("\n");
}

function SendInvoiceForm({ invoice, onSent }: { invoice: Invoice; onSent: () => void }) {
  const send = useSendInvoice();
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<SendInvoiceInput>({
    resolver: zodResolver(sendInvoiceSchema),
    defaultValues: {
      to: invoice.customer.email,
      subject: `Invoice ${invoice.number} from ${invoice.business.name}`,
      message: defaultMessage(invoice),
    },
  });
  const { errors, isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(async (data) => {
    setFailure(null);
    try {
      const { delivery } = await send.mutateAsync({ id: invoice.id, data });
      onSent();
      const preview = delivery.previewUrl;
      toast.success(`Invoice ${invoice.number} sent to ${data.to}`, {
        description:
          delivery.mode === "ethereal"
            ? "Test mode: captured by an Ethereal test inbox, not delivered."
            : "The invoice is marked as sent.",
        action: preview ? { label: "View email", onClick: () => window.open(preview, "_blank", "noopener,noreferrer") } : undefined,
        duration: preview ? 15000 : 6000,
      });
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        for (const [path, message] of Object.entries(error.fieldErrors)) {
          if (path === "to" || path === "subject" || path === "message") form.setError(path, { message });
        }
      }
      setFailure(error instanceof Error ? error.message : "The email couldn't be sent.");
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <DialogHeader
        title={`Send invoice ${invoice.number}`}
        description={`Emails the invoice for ${formatCents(invoice.totals.totalCents)}. Hidden custom fields are never included.`}
      />
      {failure && (
        <div role="alert" className="flex gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>{failure}</p>
        </div>
      )}
      <Field name="send.to" label="To" error={errors.to?.message} hint="Use an address you control while testing.">
        {(control) => <Input {...control} {...form.register("to")} type="email" autoComplete="email" />}
      </Field>
      <Field name="send.subject" label="Subject" error={errors.subject?.message}>
        {(control) => <Input {...control} {...form.register("subject")} />}
      </Field>
      <Field name="send.message" label="Message" optional error={errors.message?.message}>
        {(control) => <Textarea {...control} {...form.register("message")} rows={7} />}
      </Field>
      <DialogFooter>
        <Button onClick={onSent}>Cancel</Button>
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle aria-hidden className="animate-spin" /> : <Send aria-hidden />}
          {isSubmitting ? "Sending…" : "Send invoice"}
        </Button>
      </DialogFooter>
    </form>
  );
}
