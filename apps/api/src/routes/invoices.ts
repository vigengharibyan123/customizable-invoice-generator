import { invoiceInputSchema, sendInvoiceSchema, type ApiErrorBody } from "@invoice/shared";
import { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import type { z } from "zod";
import { sendInvoiceEmail } from "../email/send-invoice";
import type { Mailer } from "../email/transport";
import type { Env } from "../env";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import type { InvoiceRepository } from "../invoices/repository";

export interface InvoicesRouterDeps {
  repo: InvoiceRepository;
  mailer: Mailer;
  env: Env;
}

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) throw ValidationError.fromZod(result.error);
  return result.data;
}

const rateLimitedBody: ApiErrorBody = {
  error: {
    code: "RATE_LIMITED",
    message: "Too many emails in a short time. Wait a minute, then try again.",
  },
};

export function createInvoicesRouter({ repo, mailer, env }: InvoicesRouterDeps): Router {
  const router = Router();

  function findInvoice(id: string) {
    const invoice = repo.get(id);
    if (!invoice) throw new NotFoundError();
    return invoice;
  }

  // Every send hits a paid, reputation-sensitive email provider, so it gets its own budget.
  const sendLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: rateLimitedBody,
    skip: () => env.NODE_ENV === "test",
  });

  router.get("/", (_req, res) => {
    res.json({ invoices: repo.list() });
  });

  // Declared before "/:id" so "defaults" isn't taken for an invoice id.
  router.get("/defaults", (_req, res) => {
    res.json(repo.defaults());
  });

  router.post("/", (req, res) => {
    const invoice = repo.create(parseBody(invoiceInputSchema, req.body));
    res.status(201).location(`${req.baseUrl}/${invoice.id}`).json({ invoice });
  });

  router.get("/:id", (req, res) => {
    res.json({ invoice: findInvoice(req.params.id) });
  });

  router.put("/:id", (req, res) => {
    const invoice = repo.update(req.params.id, parseBody(invoiceInputSchema, req.body));
    if (!invoice) throw new NotFoundError();
    res.json({ invoice });
  });

  router.delete("/:id", (req, res) => {
    const result = repo.remove(req.params.id);
    if (result === "not_found") throw new NotFoundError();
    if (result === "sent") throw new ConflictError("Sent invoices can't be deleted");
    res.status(204).end();
  });

  // The limiter in front of the handler hides the typed route params, hence the annotation.
  router.post("/:id/send", sendLimiter, async (req: Request<{ id: string }>, res) => {
    const options = parseBody(sendInvoiceSchema, req.body);
    const delivery = await sendInvoiceEmail(mailer, env, findInvoice(req.params.id), options);
    const invoice = repo.markSent(req.params.id, new Date().toISOString());
    if (!invoice) throw new NotFoundError();
    res.json({ invoice, delivery: { mode: mailer.mode, previewUrl: delivery.previewUrl } });
  });

  return router;
}
