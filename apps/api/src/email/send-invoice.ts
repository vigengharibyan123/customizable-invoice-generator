import type { Invoice, sendInvoiceSchema } from "@invoice/shared";
import type { z } from "zod";
import type { Env } from "../env";
import { EmailFailedError } from "../errors";
import { renderInvoiceEmail } from "./invoice-email";
import type { Mailer, SendResult } from "./transport";

export type SendInvoiceOptions = z.output<typeof sendInvoiceSchema>;

const HINTS: Record<string, string> = {
  EAUTH: "Check SMTP_USER and SMTP_PASS.",
  ECONNECTION: "Check SMTP_HOST, SMTP_PORT and SMTP_SECURE.",
  EDNS: "Check SMTP_HOST.",
  ESOCKET: "Check SMTP_HOST, SMTP_PORT and SMTP_SECURE.",
  ETIMEDOUT: "Check SMTP_HOST, SMTP_PORT and SMTP_SECURE.",
  ETLS: "Check SMTP_PORT and SMTP_SECURE.",
};

/**
 * Turns a Nodemailer error into a message worth showing. `response` holds the provider's SMTP
 * reply, which says what actually went wrong (e.g. Resend's sandbox only delivers to the
 * account owner); the leading status codes ("550 5.7.1") are noise for people.
 */
function failureMessage(error: unknown, env: Env): string {
  if (!(error instanceof Error)) return "The email couldn't be sent. Please try again.";
  const { response, code } = error as { response?: unknown; code?: unknown };
  const reply =
    typeof response === "string" ? response.replace(/^\d{3}[ -](\d\.\d{1,3}\.\d{1,3} )?/, "") : "";
  const hint = typeof code === "string" ? HINTS[code] : undefined;
  const message = [`The email couldn't be sent: ${reply || error.message}`, hint]
    .filter(Boolean)
    .join(" ");
  // Providers don't echo passwords back, but never risk one reaching a browser.
  return env.SMTP_PASS ? message.replaceAll(env.SMTP_PASS, "[redacted]") : message;
}

export async function sendInvoiceEmail(
  mailer: Mailer,
  env: Env,
  invoice: Invoice,
  { to, subject, message }: SendInvoiceOptions,
): Promise<SendResult> {
  const { html, text } = renderInvoiceEmail(invoice, message);
  try {
    return await mailer.send({
      from: env.EMAIL_FROM,
      to,
      replyTo: invoice.business.email || undefined,
      subject,
      html,
      text,
    });
  } catch (error) {
    console.error(`Sending invoice ${invoice.number} failed:`, error);
    throw new EmailFailedError(failureMessage(error, env));
  }
}
