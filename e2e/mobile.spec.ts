import { expect, test } from "@playwright/test";

test("on a phone, the editor switches between editing and a live preview", async ({ page }) => {
  await page.goto("/invoices/new");
  await page.locator("#field-customer-name").fill("Pocket Cafe");
  await page.getByLabel("Item 1 Description").fill("Menu design");
  await page.getByLabel("Item 1 Quantity").fill("2");
  await page.getByLabel("Item 1 Price").fill("50");
  await page.getByLabel("Discount", { exact: true }).fill("10");
  await page.getByLabel("Tax rate").fill("10");

  const preview = page.getByRole("article", { name: /^Invoice/ });
  await expect(preview).toBeHidden();
  await page.getByRole("button", { name: "Preview", pressed: false }).click();
  await expect(preview).toBeVisible();
  await expect(preview).toContainText("Pocket Cafe");
  await expect(preview.getByText("$99.00").first()).toBeVisible();

  // Nothing overflows horizontally on a narrow screen.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
