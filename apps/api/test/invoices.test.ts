import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Invoice, InvoiceInput } from "@invoice/shared";
import { eq } from "drizzle-orm";
import type { Express } from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Database } from "../src/db/client";
import { invoiceLineItems } from "../src/db/schema";
import { createMailer, type EmailMessage, type Mailer } from "../src/email/transport";
import { DEFAULT_BUSINESS } from "../src/invoices/default-business";
import { createInvoiceRepository } from "../src/invoices/repository";
import { createTestApp, invoiceInput, sendRequest, testEnv } from "./fixtures";

let app: Express;
let db: Database;

beforeEach(() => {
  ({ app, db } = createTestApp());
});

afterEach(() => {
  db.$client.close();
  vi.restoreAllMocks();
});

/** Swaps in a different mailer (with a fresh database) for one test. */
function useMailer(mailer: Mailer): void {
  db.$client.close();
  ({ app, db } = createTestApp(mailer));
}

async function createInvoice(input: InvoiceInput = invoiceInput()): Promise<Invoice> {
  const res = await request(app).post("/api/invoices").send(input).expect(201);
  return res.body.invoice;
}

describe("GET /api/health", () => {
  it("reports that the API is up", async () => {
    await request(app).get("/api/health").expect(200, { ok: true });
  });
});

describe("POST /api/invoices", () => {
  it("creates a draft with totals computed on the server", async () => {
    const res = await request(app).post("/api/invoices").send(invoiceInput()).expect(201);
    const invoice: Invoice = res.body.invoice;

    expect(res.headers.location).toBe(`/api/invoices/${invoice.id}`);
    expect(invoice.status).toBe("draft");
    expect(invoice.sentAt).toBeNull();
    expect(invoice.totals).toEqual({
      lineAmountsCents: [10000],
      subtotalCents: 10000,
      discountCents: 1000,
      taxableCents: 9000,
      taxCents: 900,
      totalCents: 9900,
    });
  });

  it("ignores totals, ids and status sent by the client", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .send({
        ...invoiceInput(),
        id: "picked-by-client",
        status: "sent",
        totals: { subtotalCents: 1, totalCents: 1 },
      })
      .expect(201);
    const invoice: Invoice = res.body.invoice;

    expect(invoice.id).not.toBe("picked-by-client");
    expect(invoice.status).toBe("draft");
    expect(invoice.totals.totalCents).toBe(9900);
    expect(invoice.lineItems[0].id).not.toBe("client-item-1");
  });

  it("rejects a duplicate invoice number with 409 and a field error", async () => {
    await createInvoice();
    const res = await request(app).post("/api/invoices").send(invoiceInput()).expect(409);

    expect(res.body.error).toEqual({
      code: "CONFLICT",
      message: "Invoice number INV-0042 is already used",
      fieldErrors: { number: "Invoice number INV-0042 is already used" },
    });
  });

  it("rejects a negative quantity with 422", async () => {
    const lineItems = [{ id: "1", description: "Logo design", quantity: "-2", unitPrice: "50" }];
    const res = await request(app)
      .post("/api/invoices")
      .send(invoiceInput({ lineItems }))
      .expect(422);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fieldErrors["lineItems.0.quantity"]).toBe("Quantity can't be negative");
  });

  it("rejects a discount larger than the subtotal with 422", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .send(invoiceInput({ discount: "100.01" }))
      .expect(422);

    expect(res.body.error.fieldErrors.discount).toBe("Discount can't be more than the subtotal");
  });

  it("answers malformed JSON with 400", async () => {
    const res = await request(app)
      .post("/api/invoices")
      .set("Content-Type", "application/json")
      .send('{"number": "INV-0042",')
      .expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /api/invoices/:id", () => {
  it("round-trips amounts as decimal strings, in order, with custom field visibility", async () => {
    const created = await createInvoice(
      invoiceInput({
        lineItems: [
          { id: "1", description: "Discovery workshop", quantity: "2", unitPrice: "50" },
          { id: "2", description: "Development", quantity: "1.500", unitPrice: "95.5" },
          { id: "3", description: "Domain renewal", quantity: "1", unitPrice: "0.99" },
        ],
      }),
    );
    const res = await request(app).get(`/api/invoices/${created.id}`).expect(200);
    const invoice: Invoice = res.body.invoice;

    expect(invoice).toEqual(created);
    expect(
      invoice.lineItems.map(({ description, quantity, unitPrice }) => [
        description,
        quantity,
        unitPrice,
      ]),
    ).toEqual([
      ["Discovery workshop", "2", "50.00"],
      ["Development", "1.5", "95.50"],
      ["Domain renewal", "1", "0.99"],
    ]);
    expect(invoice.totals.lineAmountsCents).toEqual([10000, 14325, 99]);
    expect(invoice.discount).toBe("10.00");
    expect(invoice.taxRate).toBe("10");
    expect(invoice.customFields.map(({ label, visible }) => [label, visible])).toEqual([
      ["PO Number", true],
      ["Internal note", false],
    ]);
    expect(invoice.customer.address).toBe("530 Fifth Ave, Floor 9\nNew York, NY 10036");
  });

  it("returns 404 for an unknown invoice", async () => {
    const res = await request(app).get("/api/invoices/does-not-exist").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("GET /api/invoices", () => {
  it("lists summaries, most recently issued first", async () => {
    const older = await createInvoice(
      invoiceInput({ number: "INV-0041", issueDate: "2026-09-01", dueDate: "2026-10-01" }),
    );
    const newer = await createInvoice();
    const res = await request(app).get("/api/invoices").expect(200);

    expect(res.body.invoices.map((invoice: { id: string }) => invoice.id)).toEqual([
      newer.id,
      older.id,
    ]);
    expect(res.body.invoices[0]).toEqual({
      id: newer.id,
      number: "INV-0042",
      status: "draft",
      customerName: "Meridian Dental Group",
      issueDate: "2026-10-20",
      dueDate: "2026-11-19",
      totalCents: 9900,
      sentAt: null,
      updatedAt: newer.updatedAt,
    });
  });
});

describe("GET /api/invoices/defaults", () => {
  it("suggests the next number and the business from the latest invoice", async () => {
    const empty = await request(app).get("/api/invoices/defaults").expect(200);
    expect(empty.body).toEqual({ number: "INV-0001", business: DEFAULT_BUSINESS, accentColor: "oak" });

    const business = { ...invoiceInput().business, phone: "(718) 555-0199" };
    await createInvoice(invoiceInput({ number: "INV-0007", business }));
    const res = await request(app).get("/api/invoices/defaults").expect(200);

    expect(res.body).toEqual({ number: "INV-0008", business, accentColor: "oak" });
  });
});

describe("PUT /api/invoices/:id", () => {
  it("replaces the line items and recomputes the totals", async () => {
    const created = await createInvoice();
    const lineItems = [
      { id: "new-1", description: "Logo refresh", quantity: "1", unitPrice: "1200" },
      { id: "new-2", description: "Business cards", quantity: "250", unitPrice: "0.40" },
    ];
    const res = await request(app)
      .put(`/api/invoices/${created.id}`)
      .send(invoiceInput({ lineItems, discount: "0" }))
      .expect(200);
    const invoice: Invoice = res.body.invoice;

    expect(invoice.lineItems.map((item) => item.description)).toEqual([
      "Logo refresh",
      "Business cards",
    ]);
    expect(invoice.totals).toMatchObject({
      subtotalCents: 130000,
      taxCents: 13000,
      totalCents: 143000,
    });
    expect(invoice.createdAt).toBe(created.createdAt);
    const storedItems = db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, created.id))
      .all();
    expect(storedItems).toHaveLength(2);
  });

  it("rejects taking another invoice's number with 409", async () => {
    await createInvoice();
    const other = await createInvoice(invoiceInput({ number: "INV-0043" }));
    const res = await request(app)
      .put(`/api/invoices/${other.id}`)
      .send(invoiceInput())
      .expect(409);

    expect(res.body.error.fieldErrors.number).toBe("Invoice number INV-0042 is already used");
  });

  it("returns 404 for an unknown invoice", async () => {
    await request(app).put("/api/invoices/does-not-exist").send(invoiceInput()).expect(404);
  });
});

describe("POST /api/invoices/:id/send", () => {
  it("emails the invoice and marks it as sent", async () => {
    const created = await createInvoice();
    const res = await request(app)
      .post(`/api/invoices/${created.id}/send`)
      .send(sendRequest)
      .expect(200);

    expect(res.body.delivery).toEqual({ mode: "json", previewUrl: null });
    expect(res.body.invoice.status).toBe("sent");
    expect(Date.parse(res.body.invoice.sentAt)).not.toBeNaN();
  });

  it("sends from EMAIL_FROM with the business as reply-to", async () => {
    const sent: EmailMessage[] = [];
    const recorder: Mailer = {
      mode: "json",
      description: "recorder",
      send: async (message) => {
        sent.push(message);
        return { messageId: "<test@lumenandoak.example>", previewUrl: null };
      },
    };
    useMailer(recorder);
    const created = await createInvoice();
    await request(app).post(`/api/invoices/${created.id}/send`).send(sendRequest).expect(200);

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      from: testEnv.EMAIL_FROM,
      to: "office@meridiandental.example",
      replyTo: "billing@lumenandoak.example",
      subject: "Invoice INV-0042 from Lumen & Oak Studio",
    });
    expect(sent[0].html).toContain("Invoice INV-0042");
    expect(sent[0].text).toContain("Amount due: $99.00");
  });

  it("validates the recipient", async () => {
    const created = await createInvoice();
    const res = await request(app)
      .post(`/api/invoices/${created.id}/send`)
      .send({ ...sendRequest, to: "dana at meridian" })
      .expect(422);

    expect(res.body.error.fieldErrors.to).toBeDefined();
  });

  it("reports the provider's reason as 502 and leaves the invoice a draft", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const rejecting: Mailer = {
      mode: "smtp",
      description: "rejecting",
      send: async () => {
        throw Object.assign(
          new Error(
            "Can't send mail - all recipients were rejected: 550 You can only send testing emails to your own email address",
          ),
          {
            code: "EENVELOPE",
            responseCode: 550,
            response: "550 You can only send testing emails to your own email address",
          },
        );
      },
    };
    useMailer(rejecting);
    const created = await createInvoice();
    const res = await request(app)
      .post(`/api/invoices/${created.id}/send`)
      .send(sendRequest)
      .expect(502);

    expect(res.body.error).toEqual({
      code: "EMAIL_FAILED",
      message:
        "The email couldn't be sent: You can only send testing emails to your own email address",
    });
    const after = await request(app).get(`/api/invoices/${created.id}`).expect(200);
    expect(after.body.invoice.status).toBe("draft");
  });

  it("returns 404 for an unknown invoice", async () => {
    await request(app).post("/api/invoices/does-not-exist/send").send(sendRequest).expect(404);
  });
});

describe("DELETE /api/invoices/:id", () => {
  it("deletes a draft together with its line items", async () => {
    const draft = await createInvoice();
    await request(app).delete(`/api/invoices/${draft.id}`).expect(204);

    await request(app).get(`/api/invoices/${draft.id}`).expect(404);
    expect(db.select().from(invoiceLineItems).all()).toEqual([]);
  });

  it("refuses to delete a sent invoice", async () => {
    const created = await createInvoice();
    await request(app).post(`/api/invoices/${created.id}/send`).send(sendRequest).expect(200);
    const res = await request(app).delete(`/api/invoices/${created.id}`).expect(409);

    expect(res.body.error).toEqual({ code: "CONFLICT", message: "Sent invoices can't be deleted" });
    await request(app).get(`/api/invoices/${created.id}`).expect(200);
  });

  it("returns 404 for an unknown invoice", async () => {
    await request(app).delete("/api/invoices/does-not-exist").expect(404);
  });
});

describe("other routes", () => {
  it("answers unknown API routes with a JSON 404", async () => {
    const res = await request(app).get("/api/payments").expect(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

describe("database constraints", () => {
  it("rejects invalid money written past the API", async () => {
    const { id } = await createInvoice();
    const insertItem = db.$client.prepare(
      `insert into invoice_line_items (id, invoice_id, position, description, quantity, unit_price_cents, amount_cents)
       values (?, ?, 1, 'Refund', '1', ?, 0)`,
    );

    expect(() => insertItem.run("negative-price", id, -500)).toThrow(/CHECK constraint failed/);
    expect(() =>
      db.$client
        .prepare("update invoices set discount_cents = subtotal_cents + 1 where id = ?")
        .run(id),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe("serving the web app", () => {
  it("serves assets, falls back to index.html for client routes and 404s missing assets", async () => {
    const webDist = mkdtempSync(path.join(tmpdir(), "invoice-web-"));
    mkdirSync(path.join(webDist, "assets"));
    writeFileSync(path.join(webDist, "index.html"), "<!doctype html><title>Invoices</title>");
    writeFileSync(path.join(webDist, "assets", "app-3f9a.js"), "console.log('app');");
    const web = createApp({
      repo: createInvoiceRepository(db),
      mailer: createMailer(testEnv),
      env: testEnv,
      webDist,
    });

    try {
      const asset = await request(web).get("/assets/app-3f9a.js").expect(200);
      expect(asset.headers["cache-control"]).toContain("immutable");
      const page = await request(web).get("/invoices/123/edit").expect(200);
      expect(page.text).toContain("<title>Invoices</title>");
      expect(page.headers["content-security-policy"]).toContain("script-src 'self'");
      await request(web).get("/assets/missing-1234.js").expect(404);
      await request(web).get("/api/nope").expect(404);
    } finally {
      rmSync(webDist, { recursive: true, force: true });
    }
  });
});

describe("brand color", () => {
  it("defaults to oak, round-trips a chosen color and carries over to new invoices", async () => {
    const created = await request(app).post("/api/invoices").send(invoiceInput()).expect(201);
    expect((created.body.invoice as Invoice).accentColor).toBe("oak");

    const id = (created.body.invoice as Invoice).id;
    const updated = await request(app)
      .put(`/api/invoices/${id}`)
      .send(invoiceInput({ accentColor: "terracotta" }))
      .expect(200);
    expect((updated.body.invoice as Invoice).accentColor).toBe("terracotta");

    const defaults = await request(app).get("/api/invoices/defaults").expect(200);
    expect(defaults.body.accentColor).toBe("terracotta");
  });

  it("rejects an unknown color", async () => {
    const response = await request(app)
      .post("/api/invoices")
      .send({ ...invoiceInput(), accentColor: "neon" })
      .expect(422);
    expect(response.body.error.fieldErrors).toHaveProperty("accentColor");
  });
});
