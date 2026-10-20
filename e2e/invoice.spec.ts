import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const uniqueNumber = () => `E2E-${Date.now().toString(36).toUpperCase()}`;
const preview = (page: Page) => page.getByRole("article", { name: /^Invoice/ });

/** Fills the spec's reference invoice: 2 × $50 − $10 discount + 10% tax = $99.00. */
async function fillReferenceInvoice(page: Page, number: string) {
  await page.goto("/invoices/new");
  await page.locator("#field-number").fill(number);
  await page.locator("#field-customer-name").fill("Acme Testing Co.");
  await page.locator("#field-customer-email").fill("billing@acme.example");
  await page.getByLabel("Item 1 Description").fill("Strategy workshop");
  await page.getByLabel("Item 1 Quantity").fill("2");
  await page.getByLabel("Item 1 Price").fill("50");
  await page.getByLabel("Discount", { exact: true }).fill("10");
  await page.getByLabel("Tax rate").fill("10");
}

test("creates an invoice with the spec's totals, saves it and loads it back", async ({ page }) => {
  const number = uniqueNumber();
  await fillReferenceInvoice(page, number);

  await expect(preview(page).getByText("$99.00").first()).toBeVisible();
  await expect(preview(page)).toContainText("$100.00"); // subtotal
  await expect(preview(page)).toContainText("−$10.00"); // discount
  await expect(preview(page)).toContainText("$9.00"); // tax

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name: number })).toBeVisible();

  await page.reload();
  await expect(page.locator("#field-customer-name")).toHaveValue("Acme Testing Co.");
  await expect(page.getByLabel("Item 1 Quantity")).toHaveValue("2");
  await expect(page.getByLabel("Item 1 Price")).toHaveValue("50.00");
  await expect(preview(page).getByText("$99.00").first()).toBeVisible();

  await page.goto("/invoices");
  await expect(page.getByRole("link", { name: number })).toBeVisible();
});

test("custom fields: visible ones print, hidden ones don't, totals never change", async ({ page }) => {
  await fillReferenceInvoice(page, uniqueNumber());

  await page.getByRole("button", { name: "PO Number" }).click();
  await page.locator("#field-customFields-0-value").fill("PO-7781");
  await page.getByRole("button", { name: "Add custom field" }).click();
  await page.locator("#field-customFields-1-label").fill("Internal note");
  await page.locator("#field-customFields-1-value").fill("Referred by Maya");
  await page.getByRole("switch", { name: "Show Internal note on the invoice" }).click();

  await expect(preview(page)).toContainText("PO-7781");
  await expect(preview(page)).not.toContainText("Referred by Maya");
  await expect(preview(page).getByText("$99.00").first()).toBeVisible();

  // Print view: only the invoice is shown — no toolbar, no form, no hidden fields.
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("button", { name: "Create invoice" })).toBeHidden();
  await expect(page.locator("#field-customer-name")).toBeHidden();
  await expect(preview(page)).toBeVisible();
  await expect(page.getByText("Live preview")).toBeHidden();
  await expect(preview(page)).not.toContainText("Referred by Maya");
});

test("blocks negative numbers and an oversized discount", async ({ page }) => {
  await fillReferenceInvoice(page, uniqueNumber());

  const quantity = page.getByLabel("Item 1 Quantity");
  await quantity.fill("");
  await quantity.pressSequentially("-3");
  await expect(quantity).toHaveValue("3"); // the minus sign can't be typed

  const discount = page.getByLabel("Discount", { exact: true });
  await discount.fill("1000");
  await discount.blur();
  await expect(page.getByText("Discount can't be more than the subtotal").first()).toBeVisible();

  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "need" })).toContainText("Discount");
  await expect(page).toHaveURL(/\/invoices\/new$/);
});

test("sends the invoice by email and marks it as sent", async ({ page }) => {
  const number = uniqueNumber();
  await fillReferenceInvoice(page, number);
  await page.getByRole("button", { name: "Send invoice by email" }).click();

  const dialog = page.getByRole("dialog", { name: `Send invoice ${number}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("To")).toHaveValue("billing@acme.example");
  await dialog.getByRole("button", { name: "Send invoice" }).click();

  await expect(page.getByText(`Invoice ${number} sent to billing@acme.example`)).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Sent on" })).toBeVisible();
});

test("has no serious accessibility violations", async ({ page }) => {
  for (const path of ["/invoices", "/invoices/new"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes.map((n) => n.target)]), null, 2)).toEqual([]);
  }
});
