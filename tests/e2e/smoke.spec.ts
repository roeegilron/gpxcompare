import { expect, test } from "@playwright/test";

test("app renders upload panel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Upload GPX files" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset session" })).toBeVisible();
});
