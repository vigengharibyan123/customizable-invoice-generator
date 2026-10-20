import path from "node:path";
import express, { type Express } from "express";
import helmet from "helmet";
import type { Mailer } from "./email/transport";
import type { Env } from "./env";
import { errorHandler, NotFoundError } from "./errors";
import type { InvoiceRepository } from "./invoices/repository";
import { createInvoicesRouter } from "./routes/invoices";

export interface AppDeps {
  repo: InvoiceRepository;
  mailer: Mailer;
  env: Env;
  /** Built web app to serve next to the API (production); omitted in development and tests. */
  webDist?: string;
}

export function createApp({ repo, mailer, env, webDist }: AppDeps): Express {
  const app = express();
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // UI libraries (toasts, popovers) inject <style> tags at runtime; scripts stay strict.
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", "data:"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          // The app is often run over plain http://localhost; upgrading would break it.
          upgradeInsecureRequests: null,
        },
      },
    }),
  );
  app.use(express.json({ limit: "200kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api/invoices", createInvoicesRouter({ repo, mailer, env }));
  app.use("/api", () => {
    throw new NotFoundError("API route not found");
  });

  if (webDist) {
    // Vite fingerprints everything in assets/, so those files can be cached forever. A missing
    // asset is a 404 rather than index.html, which browsers would fail to run as a script.
    app.use(
      "/assets",
      express.static(path.join(webDist, "assets"), {
        immutable: true,
        maxAge: "1y",
        fallthrough: false,
      }),
    );
    app.use(express.static(webDist));
    // Client-side routes (e.g. /invoices/123) all load the single-page app.
    app.get("/{*splat}", (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
