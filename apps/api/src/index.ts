import { existsSync } from "node:fs";
import { createApp } from "./app";
import { createDatabase } from "./db/client";
import { createMailer } from "./email/transport";
import { loadEnv } from "./env";
import { createInvoiceRepository } from "./invoices/repository";
import { WEB_DIST } from "./paths";

const env = loadEnv();
const db = createDatabase(env.DATABASE_PATH);
const mailer = createMailer(env);
const webDist = existsSync(WEB_DIST) ? WEB_DIST : undefined;
const app = createApp({ repo: createInvoiceRepository(db), mailer, env, webDist });

const server = app.listen(env.PORT, (error) => {
  if (error) {
    console.error(`Couldn't start the API on port ${env.PORT}:`, error.message);
    process.exit(1);
  }
  console.log(`API listening on http://localhost:${env.PORT}`);
  console.log(`Email mode: ${mailer.description}`);
  if (webDist) console.log(`Serving the web app from ${webDist}`);
});

function shutdown() {
  server.close(() => {
    db.$client.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
