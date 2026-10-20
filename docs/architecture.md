# Architecture

This document explains how the pieces fit together, for reviewers and future maintainers.

## Overview

```
┌────────────────────────── Browser ──────────────────────────┐        ┌──────────────────── Node (Express 5) ───────────────────┐
│ React SPA (apps/web)                                         │        │ REST API (apps/api)                                      │
│                                                              │  JSON  │                                                          │
│  InvoiceEditor ── react-hook-form + zodResolver(schema) ─────┼───────▶│  routes/invoices.ts ── schema.safeParse(body)            │
│      │ useWatch                                              │        │      │                                                   │
│      ▼                                                       │        │      ▼                                                   │
│  InvoiceDocument (preview = printed page)                    │        │  invoices/repository.ts ── calculateTotals() ── Drizzle  │
│      ▲ calculateLiveTotals()                                 │        │      │                                       │           │
│                                                              │        │      ▼                                       ▼           │
│  TanStack Query cache ◀── lib/api.ts (typed fetch) ◀─────────┼────────┤  email/ (render + Nodemailer)          SQLite file      │
└──────────────────────────────────────────────────────────────┘        └──────────────────────────────────────────────────────────┘
                 ▲                                                                         ▲
                 └──────────────── packages/shared (Zod schema, totals, formatting) ───────┘
```

## Packages

| Package | Responsibility | Key files |
| --- | --- | --- |
| `packages/shared` | Invoice domain rules: no framework, no I/O | `invoice/schema.ts` (validation and types), `invoice/calculate.ts` (totals), `invoice/money.ts` (decimal ↔ cents), `invoice/dates.ts` (payment terms), `invoice/format.ts`, `invoice/status.ts` |
| `apps/api` | HTTP, persistence, email | `app.ts` (middleware), `routes/invoices.ts`, `invoices/repository.ts`, `db/schema.ts` and `drizzle/` (migrations), `email/` |
| `apps/web` | User interface | `features/invoice/editor/*`, `features/invoice/preview/*`, `features/invoice/list/*`, `lib/api.ts`, `lib/queries.ts` |

The shared package is consumed as TypeScript source (no build step): Vite compiles it for the browser, `tsx` runs it in development, and esbuild bundles it into `apps/api/dist` for production.

## Data flow: saving an invoice

1. Every input is registered with react-hook-form. Amount fields keep the raw string, and a sanitizer strips anything other than digits and one decimal point.
2. On submit, `zodResolver(invoiceInputSchema)` validates the whole form, including cross-field rules: the discount can't exceed the subtotal, and the due date can't be before the issue date. Errors appear next to the fields and in an error summary.
3. `PUT /api/invoices/:id` (or `POST` for a new invoice) sends the values as decimal strings.
4. The API validates the body again with the same schema (422 with `fieldErrors` on failure), computes the totals itself, converts money to integer cents, and writes the invoice and its child rows in one transaction.
5. The response is the stored invoice. The editor resets the form to it, so it isn't marked dirty, and TanStack Query updates its cache.

## Money

- **Input → domain**: decimal strings, validated by regex and limits (cents for money, up to 3 decimals for quantity and tax rate).
- **Arithmetic**: `big.js` only (`calculateTotals`), rounding half up at exactly two points, as the spec requires: each line amount, and the tax.
- **Storage**: integer cents (`unit_price_cents`, `discount_cents`, `total_cents`). Quantity and tax rate are normalized decimal strings, because SQLite has no exact decimal type.
- **Display**: `Intl.NumberFormat("en-US", { currency: "USD" })`.

## Printing

`InvoiceDocument` renders at 816 px wide (8.5 in at 96 dpi). On screen, `ScaledPreview` scales it down with a CSS transform. In print:

- the app chrome is hidden with Tailwind's `print:hidden`;
- the transform is removed;
- `@page { size: letter; margin: 0 }` means Chrome has no room for its URL and date header;
- the document's own padding forms the visual margin;
- table rows and the totals block use `break-inside: avoid`.

Hidden custom fields are filtered out before rendering, never just hidden with CSS.

## Email

`email/transport.ts` picks the transport once at startup:

1. **smtp** when `SMTP_HOST` and `SMTP_PASS` are set;
2. otherwise **json** under tests;
3. otherwise **ethereal**, a test inbox with a preview URL.

`invoice-email.tsx` renders an email-safe, table-based HTML version with React's `renderToStaticMarkup`, plus a hand-written plain-text version. The reply-to is the business email. The send endpoint is rate-limited, and the subject is validated against header injection.

## Validation layers

| Layer | Purpose |
| --- | --- |
| Input sanitizer (web) | Makes a negative sign impossible to type |
| Zod schema (web) | Immediate, field-level feedback |
| Zod schema (API) | Never trust the client; same rules, same messages |
| SQLite CHECK constraints | Last line of defence for data integrity |
