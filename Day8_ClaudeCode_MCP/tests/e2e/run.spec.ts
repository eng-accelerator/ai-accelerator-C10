import { test, expect, type Page } from "@playwright/test";

async function ask(page: Page, question: string) {
  await page.goto("/");
  await page.getByTestId("question").fill(question);
  await page.getByTestId("ask").click();
}

test("synthesize path: answers, decision with a fired signal, combined answer", async ({ page }) => {
  await ask(page, "[synth] how should I shard postgres?");
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
  for (const l of ["A", "B", "C"]) await expect(page.getByTestId(`answer-${l}`)).toHaveAttribute("data-status", "done");
  await expect(page.getByTestId("meter-unique_fact")).toContainText("◆ fired");
  await expect(page.getByTestId("meter-disagreement")).not.toContainText("fired");
  await expect(page.getByTestId("run-footer")).toContainText("run complete");
  await expect(page.getByTestId("status")).toHaveText("idle");
});

test("skip path: no synthesis panel, skip note shown", async ({ page }) => {
  await ask(page, "[skip] boiling point of water?");
  await expect(page.getByTestId("skip-note")).toContainText("synthesizer skipped");
  await expect(page.getByTestId("synthesis")).toHaveCount(0);
});

test("one model fails: its panel shows the error and the run continues", async ({ page }) => {
  await ask(page, "[error] question");
  await expect(page.getByTestId("answer-B")).toHaveAttribute("data-status", "error");
  await expect(page.getByTestId("answer-B")).toContainText("simulated provider error");
  await expect(page.getByTestId("decision")).toBeVisible();
  await expect(page.getByTestId("reviews-toggle")).toContainText("expand 2 reviews");
});

test("two models fail: run fails with a reason and no decision", async ({ page }) => {
  await ask(page, "[fail] question");
  await expect(page.getByTestId("run-failed")).toContainText("at least 2 are needed");
  await expect(page.getByTestId("decision")).toHaveCount(0);
});

test("no decider: notice shown and synthesis runs by default", async ({ page }) => {
  await ask(page, "[nodecider] question");
  await expect(page.getByTestId("no-decider")).toBeVisible();
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
});

test("reviews expand on click", async ({ page }) => {
  await ask(page, "[synth] question");
  await page.getByTestId("reviews-toggle").click();
  await expect(page.getByTestId("review-A")).toContainText("Strengths");
});

test("synthesis failure can be retried without re-running the answers", async ({ page }) => {
  await ask(page, "[synthfail] question");
  await expect(page.getByTestId("synthesis")).toContainText("simulated synthesizer outage");
  await page.getByTestId("synthesis-retry").click();
  await expect(page.getByTestId("synthesis")).toContainText("Combined answer");
});

test("stop cancels a running question", async ({ page }) => {
  await ask(page, "[slow] question");
  await expect(page.getByTestId("status")).toHaveText("running");
  await page.getByTestId("stop").click();
  await expect(page.getByTestId("run-stopped")).toBeVisible();
  await expect(page.getByTestId("status")).toHaveText("idle");
  await expect(page.getByTestId("answer-A")).toHaveAttribute("data-status", "pending");
});
