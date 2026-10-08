import { test, expect } from "@playwright/test";

test("idle page shows the terminal frame, hero and prompt", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("hero")).toContainText("model-council");
  await expect(page.getByTestId("status")).toHaveText("idle");
  await expect(page.getByTestId("ask")).toBeDisabled();
});

test("ask is disabled for a whitespace-only question and enabled for text", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("question").fill("   ");
  await expect(page.getByTestId("ask")).toBeDisabled();
  await page.getByTestId("question").fill("hello");
  await expect(page.getByTestId("ask")).toBeEnabled();
});

test("ask is disabled and the limit is shown for an over-long question", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("question").fill("x".repeat(20_001));
  await expect(page.getByTestId("ask")).toBeDisabled();
  await expect(page.getByTestId("question-too-long")).toContainText("20,000");
});
