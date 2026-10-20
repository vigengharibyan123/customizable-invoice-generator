import {
  ACCENT_COLORS,
  formatCents,
  formatDate,
  formatMoneyString,
  formatPercent,
  formatQuantity,
  paymentTermsLabel,
  type Business,
  type CustomField,
  type Invoice,
} from "@invoice/shared";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInvoiceText } from "./invoice-email-text";

/*
 * Email clients support only a subset of HTML and CSS, so this template sticks to nested
 * tables, inline styles and system fonts. React escapes every interpolated value, which keeps
 * user-entered text (names, notes, the personal message) from injecting markup.
 */

const color = {
  canvas: "#F4F1EA",
  paper: "#FFFFFF",
  ink: "#1C1A17",
  muted: "#6B645A",
  line: "#E5DFD3",
};

// Family names are unquoted on purpose: quotes would be entity-escaped inside style attributes.
const serif = "Georgia, Times New Roman, Times, serif";
const sans = "-apple-system, Segoe UI, Helvetica, Arial, sans-serif";
const figures: CSSProperties = { fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };

const eyebrow: CSSProperties = {
  fontSize: 12,
  lineHeight: "18px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: color.muted,
};
const body: CSSProperties = { fontSize: 15, lineHeight: "24px", color: color.ink };
const headerCell: CSSProperties = {
  ...eyebrow,
  fontWeight: 400,
  padding: "0 0 8px",
  borderBottom: `1px solid ${color.line}`,
};
const itemCell: CSSProperties = {
  fontSize: 14,
  lineHeight: "20px",
  color: color.ink,
  padding: "12px 0",
  borderBottom: `1px solid ${color.line}`,
  verticalAlign: "top",
};

function LayoutTable({
  children,
  style,
  width = "100%",
}: {
  children: ReactNode;
  style?: CSSProperties;
  width?: number | string;
}) {
  return (
    <table
      role="presentation"
      width={width}
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ borderCollapse: "collapse", ...style }}
    >
      <tbody>{children}</tbody>
    </table>
  );
}

/** One full-width row of the invoice card, spaced from the previous one. */
function Section({ children, gap = 28 }: { children: ReactNode; gap?: number }) {
  return (
    <tr>
      <td style={{ paddingTop: gap }}>{children}</td>
    </tr>
  );
}

/** Keeps the line breaks people typed (addresses, notes) without trusting them as HTML. */
function Lines({ text }: { text: string }) {
  return text.split(/\r?\n/).map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}

function AmountDue({ invoice }: { invoice: Invoice }) {
  // The business's brand color, as chosen in the editor.
  const accent = ACCENT_COLORS[invoice.accentColor];
  return (
    <LayoutTable style={{ backgroundColor: accent.soft, borderRadius: 6 }}>
      <tr>
        <td style={{ padding: "20px 24px" }}>
          <div style={eyebrow}>Amount due</div>
          <div
            style={{
              ...figures,
              fontFamily: serif,
              fontSize: 36,
              lineHeight: "44px",
              color: accent.hex,
            }}
          >
            {formatCents(invoice.totals.totalCents)}
          </div>
          <div style={{ fontSize: 14, lineHeight: "20px", color: color.ink }}>
            Due {formatDate(invoice.dueDate)}
          </div>
        </td>
      </tr>
    </LayoutTable>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ fontSize: 14, lineHeight: "22px", color: color.muted, paddingRight: 12 }}>
        {label}
      </td>
      <td align="right" style={{ ...figures, fontSize: 14, lineHeight: "22px", color: color.ink }}>
        {value}
      </td>
    </tr>
  );
}

function Parties({ invoice }: { invoice: Invoice }) {
  const { customer } = invoice;
  return (
    <LayoutTable>
      <tr>
        <td valign="top" width="55%" style={{ verticalAlign: "top", paddingRight: 16 }}>
          <div style={eyebrow}>Bill to</div>
          <div style={{ ...body, fontWeight: 600 }}>{customer.name}</div>
          {customer.email && <div style={{ ...body, fontSize: 14 }}>{customer.email}</div>}
          {customer.address && (
            <div style={{ ...body, fontSize: 14, color: color.muted }}>
              <Lines text={customer.address} />
            </div>
          )}
        </td>
        <td valign="top" width="45%" style={{ verticalAlign: "top" }}>
          <LayoutTable>
            <Detail label="Issued" value={formatDate(invoice.issueDate)} />
            <Detail label="Due" value={formatDate(invoice.dueDate)} />
            {invoice.paymentTerms !== "custom" && (
              <Detail label="Terms" value={paymentTermsLabel(invoice.paymentTerms)} />
            )}
          </LayoutTable>
        </td>
      </tr>
    </LayoutTable>
  );
}

function LineItems({ invoice }: { invoice: Invoice }) {
  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ borderCollapse: "collapse" }}
    >
      <thead>
        <tr>
          <th scope="col" align="left" style={{ ...headerCell, textAlign: "left" }}>
            Description
          </th>
          <th
            scope="col"
            align="right"
            style={{ ...headerCell, textAlign: "right", paddingLeft: 12 }}
          >
            Qty
          </th>
          <th
            scope="col"
            align="right"
            style={{ ...headerCell, textAlign: "right", paddingLeft: 12 }}
          >
            Rate
          </th>
          <th
            scope="col"
            align="right"
            style={{ ...headerCell, textAlign: "right", paddingLeft: 12 }}
          >
            Amount
          </th>
        </tr>
      </thead>
      <tbody>
        {invoice.lineItems.map((item, index) => (
          <tr key={item.id}>
            <td style={itemCell}>{item.description}</td>
            <td align="right" style={{ ...itemCell, ...figures, paddingLeft: 12 }}>
              {formatQuantity(item.quantity)}
            </td>
            <td align="right" style={{ ...itemCell, ...figures, paddingLeft: 12 }}>
              {formatMoneyString(item.unitPrice)}
            </td>
            <td align="right" style={{ ...itemCell, ...figures, paddingLeft: 12 }}>
              {formatCents(invoice.totals.lineAmountsCents[index])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  const cell: CSSProperties = total
    ? { paddingTop: 10, borderTop: `1px solid ${color.line}`, fontSize: 16, fontWeight: 700 }
    : { paddingTop: 6, fontSize: 14, color: color.muted };
  return (
    <tr>
      <td align="right" style={{ ...cell, lineHeight: "22px", paddingRight: 16 }}>
        {label}
      </td>
      <td
        align="right"
        width="120"
        style={{ ...cell, ...figures, lineHeight: "22px", color: color.ink }}
      >
        {value}
      </td>
    </tr>
  );
}

function Totals({ invoice }: { invoice: Invoice }) {
  const { totals } = invoice;
  return (
    <LayoutTable>
      <TotalRow label="Subtotal" value={formatCents(totals.subtotalCents)} />
      {totals.discountCents > 0 && (
        <TotalRow label="Discount" value={`−${formatCents(totals.discountCents)}`} />
      )}
      <TotalRow
        label={`Tax (${formatPercent(invoice.taxRate)})`}
        value={formatCents(totals.taxCents)}
      />
      <TotalRow label="Total" value={formatCents(totals.totalCents)} total />
    </LayoutTable>
  );
}

function CustomFields({ fields }: { fields: CustomField[] }) {
  return (
    <LayoutTable>
      {fields.map((field) => (
        <tr key={field.id}>
          <td style={{ fontSize: 14, lineHeight: "22px", color: color.ink }}>
            <span style={{ color: color.muted }}>{field.label}:</span> {field.value}
          </td>
        </tr>
      ))}
    </LayoutTable>
  );
}

function Footer({ business }: { business: Business }) {
  const contact = [business.email, business.phone].filter(Boolean).join(" · ");
  return (
    <td
      align="center"
      style={{ padding: "20px 16px 0", fontSize: 12, lineHeight: "18px", color: color.muted }}
    >
      <div style={{ fontWeight: 600, color: color.ink }}>{business.name}</div>
      {business.address && <div>{business.address.split(/\r?\n/).join(", ")}</div>}
      {contact && <div>{contact}</div>}
      {business.email && (
        <div style={{ paddingTop: 8 }}>Questions about this invoice? Just reply to this email.</div>
      )}
    </td>
  );
}

function InvoiceEmail({ invoice, message }: { invoice: Invoice; message: string }) {
  const { business } = invoice;
  const visibleFields = invoice.customFields.filter((field) => field.visible);
  const amountDue = formatCents(invoice.totals.totalCents);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="x-apple-disable-message-reformatting" />
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <title>{`Invoice ${invoice.number} from ${business.name}`}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: color.canvas, fontFamily: sans }}>
        {/* Preview text that inboxes show next to the subject line. */}
        <div style={{ display: "none", maxHeight: 0, overflow: "hidden", opacity: 0 }}>
          {`${amountDue} due ${formatDate(invoice.dueDate)} · Invoice ${invoice.number} from ${business.name}`}
        </div>
        <LayoutTable style={{ backgroundColor: color.canvas }}>
          <tr>
            <td align="center" style={{ padding: "32px 12px", fontFamily: sans }}>
              {/* The width attribute caps Outlook (which ignores max-width); max-width shrinks it on phones. */}
              <LayoutTable width={600} style={{ maxWidth: "100%" }}>
                <tr>
                  <td
                    style={{
                      padding: "0 4px 16px",
                      fontFamily: serif,
                      fontSize: 20,
                      lineHeight: "28px",
                      color: color.ink,
                    }}
                  >
                    {business.name}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      backgroundColor: color.paper,
                      border: `1px solid ${color.line}`,
                      borderRadius: 8,
                      padding: "32px 28px",
                      fontFamily: sans,
                    }}
                  >
                    <LayoutTable>
                      <tr>
                        <td>
                          <h1
                            style={{
                              margin: 0,
                              fontFamily: serif,
                              fontSize: 26,
                              lineHeight: "34px",
                              fontWeight: 400,
                              color: color.ink,
                            }}
                          >
                            Invoice {invoice.number}
                          </h1>
                        </td>
                      </tr>
                      <Section gap={20}>
                        <AmountDue invoice={invoice} />
                      </Section>
                      {message && (
                        <Section>
                          <div style={body}>
                            <Lines text={message} />
                          </div>
                        </Section>
                      )}
                      <Section>
                        <Parties invoice={invoice} />
                      </Section>
                      <Section>
                        <LineItems invoice={invoice} />
                      </Section>
                      <Section gap={12}>
                        <Totals invoice={invoice} />
                      </Section>
                      {visibleFields.length > 0 && (
                        <Section>
                          <CustomFields fields={visibleFields} />
                        </Section>
                      )}
                      {invoice.notes && (
                        <Section>
                          <div style={eyebrow}>Notes</div>
                          <div style={{ ...body, fontSize: 14, lineHeight: "22px" }}>
                            <Lines text={invoice.notes} />
                          </div>
                        </Section>
                      )}
                    </LayoutTable>
                  </td>
                </tr>
                <tr>
                  <Footer business={business} />
                </tr>
              </LayoutTable>
            </td>
          </tr>
        </LayoutTable>
      </body>
    </html>
  );
}

/** Renders the invoice email as HTML plus a hand-written plain-text alternative. */
export function renderInvoiceEmail(
  invoice: Invoice,
  personalMessage: string,
): { html: string; text: string } {
  const markup = renderToStaticMarkup(<InvoiceEmail invoice={invoice} message={personalMessage} />);
  return {
    html: `<!DOCTYPE html>${markup}`,
    text: renderInvoiceText(invoice, personalMessage),
  };
}
