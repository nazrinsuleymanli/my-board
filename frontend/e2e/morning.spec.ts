import { expect, test } from "@playwright/test";
import { quietMorning, todayPrague } from "./helpers";

test("tapping the morning message opens: greeting, quote, ♓ line, motivation video", async ({ page, request }) => {
  await request.put(`/api/days/${todayPrague()}/state`, { data: { mood: null, mood_asked: false, video_shown: false } });
  await page.goto("/morning");
  await expect(page.getByTestId("morning-page")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0); // no mood popup on top of the morning page
  await expect(page.getByTestId("morning-quote")).not.toBeEmpty();
  await expect(page.getByTestId("morning-pisces")).toContainText("♓");
  await expect(page.getByTestId("video-frame").locator("iframe, video")).toHaveCount(1);
  await page.getByRole("button", { name: "Start my day →" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: "How do you feel today?" })).toBeVisible(); // mood comes after
  const state = await (await request.get(`/api/days/${todayPrague()}/state`)).json();
  expect(state.video_shown).toBe(true); // video not shown twice the same day
});

test("service worker is served and registers (needed for push)", async ({ page, request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.status()).toBe(200);
  expect(sw.headers()["content-type"]).toMatch(/javascript/);
  expect(await sw.text()).toContain("notificationclick");
  await quietMorning(request);
  await page.goto("/settings");
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toMatch(/\/$/);
  await expect(page.getByTestId("morning-panel")).toBeVisible();
  await page.getByLabel("Morning time").fill("07:45");
  await expect.poll(async () => (await (await request.get("/api/settings/morning")).json()).time).toBe("07:45");
});
