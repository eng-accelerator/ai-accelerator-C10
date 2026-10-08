import { test, expect } from "@playwright/test";

test.afterEach(async ({ request }) => {
  const { defaults } = await (await request.get("/api/settings")).json();
  await request.put("/api/settings", { data: defaults });
});

test("shows the current settings, saves a new threshold, and keeps it after reopening", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("setting-answer_1")).toHaveValue("openai/gpt-6.1-sol");
  await expect(page.getByTestId("setting-decider_1")).toHaveValue("typesafe/jev-1.13");
  await page.getByTestId("setting-threshold").fill("0.95");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-saved")).toBeVisible();
  await page.getByTestId("settings-close").click();
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("setting-threshold")).toHaveValue("0.95");
});

test("rejects an invalid threshold with a readable error", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await page.getByTestId("setting-threshold").fill("2");
  await page.getByTestId("settings-save").click();
  await expect(page.getByTestId("settings-errors")).toContainText("threshold");
});

test("reset restores the defaults", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await page.getByTestId("setting-synthesizer").fill("x/other");
  await page.getByTestId("settings-save").click();
  await page.getByTestId("settings-reset").click();
  await expect(page.getByTestId("setting-synthesizer")).toHaveValue("anthropic/claude-sonnet-5.5");
});

test("a corrupt settings file shows a warning in the panel", async ({ page }) => {
  const fs = await import("node:fs/promises");
  await fs.writeFile(".e2e-settings.json", "{ not json", "utf8");
  await page.goto("/");
  await page.getByTestId("settings-link").click();
  await expect(page.getByTestId("settings-warning")).toContainText("not valid JSON");
});
