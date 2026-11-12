import { expect, test } from "@playwright/test";
import { boardState, expectColumns, makeBoard, quietMorning } from "./helpers";

test.beforeEach(async ({ request }) => quietMorning(request));

/** Real touch events: press-and-hold (dnd-kit TouchSensor has a 180ms delay so normal swipes still scroll). */
async function touchDrag(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  const cdp = await page.context().newCDPSession(page);
  const pt = (p: { x: number; y: number }) => [{ x: p.x, y: p.y, id: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(from) });
  await page.waitForTimeout(350);
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(p) });
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(150);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(400);
}

test("phone: press-and-hold drag reorders cards", async ({ page, request }) => {
  const id = await makeBoard(request, "touch", { "To Do": ["First", "Second", "Third"] });
  await page.goto(`/boards/${id}`);
  const a = (await page.getByTestId("card-Third").boundingBox())!;
  const b = (await page.getByTestId("card-First").boundingBox())!;
  await touchDrag(page, { x: a.x + a.width / 2, y: a.y + a.height / 2 }, { x: b.x + b.width / 2, y: b.y + 4 });
  await expectColumns(page, { "To Do": ["Third", "First", "Second"] });
  await expect.poll(async () => (await boardState(request, id))["To Do"]).toEqual(["Third", "First", "Second"]);
});

test("phone: bottom nav + today page fit the screen", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole("link", { name: /Month/ }).click();
  await expect(page.getByTestId("calendar")).toBeVisible();
});
