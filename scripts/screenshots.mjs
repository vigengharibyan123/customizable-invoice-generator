// Captures README screenshots and a sample PDF from a running app.
// Usage: npm run dev (and npm run db:seed), then: node scripts/screenshots.mjs
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:5173";
const outDir = new URL("../docs/screenshots/", import.meta.url);
await mkdir(outDir, { recursive: true });

const { invoices } = await fetch(`${base}/api/invoices`).then((r) => r.json());
const featured = invoices.find((invoice) => invoice.number === "INV-0002") ?? invoices[0];
if (!featured) throw new Error("No invoices found — run `npm run db:seed` first.");

const browser = await chromium.launch({ channel: process.env.CI ? undefined : "chrome" });
const shot = async (name, path, viewport, prepare) => {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}${path}`);
  await page.waitForLoadState("networkidle");
  // The editor route is lazy-loaded; wait until the invoice document is on screen.
  if (path !== "/invoices") await page.getByRole("heading", { level: 1, name: featured.number }).waitFor();
  await prepare?.(page);
  await page.screenshot({ path: new URL(`${name}.png`, outDir).pathname, fullPage: false });
  return page;
};

await shot("invoices-desktop", "/invoices", { width: 1440, height: 900 });
await shot("editor-desktop", `/invoices/${featured.id}`, { width: 1440, height: 900 });
await shot("editor-mobile", `/invoices/${featured.id}`, { width: 390, height: 844 });
await shot("preview-mobile", `/invoices/${featured.id}`, { width: 390, height: 844 }, (page) =>
  page.getByRole("button", { name: "Preview" }).click(),
);
const printPage = await shot("editor-print", `/invoices/${featured.id}`, { width: 1440, height: 900 }, (page) =>
  page.emulateMedia({ media: "print" }),
);
await printPage.pdf({
  path: new URL(`../sample-invoice.pdf`, outDir).pathname,
  preferCSSPageSize: true,
  printBackground: true,
});

await browser.close();
console.log(`Saved screenshots to ${outDir.pathname}`);
