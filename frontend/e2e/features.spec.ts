import { expect, test } from "@playwright/test";
import { quietMorning, todayPrague } from "./helpers";

test("morning: mood picker → motivated theme → motivation video", async ({ page, request }) => {
  await request.put(`/api/days/${todayPrague()}/state`, { data: { mood: null, mood_asked: false, video_shown: false } });
  await page.goto("/");
  await expect(page.getByRole("dialog", { name: "How do you feel today?" })).toBeVisible();
  await page.getByTestId("mood-motivated").click();
  await expect(page.getByRole("dialog", { name: "Motivation" })).toBeVisible();
  await expect(page.getByTestId("video-frame").locator("iframe, video")).toHaveCount(1);
  await page.getByRole("button", { name: "Let’s go" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "motivated");
  await expect(page.getByTestId("mood-chip")).toContainText("Motivated");
  // once a day only
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("skip mood → season theme with its drawn scene (no personal photos)", async ({ page, request }) => {
  await request.put(`/api/days/${todayPrague()}/state`, { data: { mood: null, mood_asked: false, video_shown: true } });
  await page.goto("/");
  await page.getByTestId("mood-season").click();
  const month = new Date().getMonth();
  const season = month === 11 || month <= 1 ? "winter" : month <= 4 ? "spring" : month <= 7 ? "summer" : "autumn";
  await expect(page.locator("html")).toHaveAttribute("data-theme", season);
  await expect(page.locator(`.hero-art .scene-${season} svg`)).toBeVisible();
  await expect(page.locator(".hero img")).toHaveCount(0);
});

test("today: add card, open it, label + time + attach any file", async ({ page, request }) => {
  await quietMorning(request);
  await page.goto("/");
  const todo = page.getByTestId("column-To Do");
  await todo.getByRole("button", { name: "+ Add a card" }).click();
  await todo.locator("textarea").fill("Call dad");
  await todo.locator("textarea").press("Enter");
  await expect(page.getByTestId("card-Call dad")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByTestId("card-Call dad").click();
  const dlg = page.getByRole("dialog", { name: "Card details" });
  await dlg.getByLabel("Label rose").click();
  await dlg.locator('input[type="time"]').fill("18:30");
  await dlg.getByTestId("file-input").setInputFiles([
    { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000" + "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex") },
    { name: "voice.m4a", mimeType: "audio/mp4", buffer: Buffer.from("fake audio") },
    { name: "plan.xyz", mimeType: "application/octet-stream", buffer: Buffer.from("anything") },
  ]);
  await expect(dlg.locator(".att")).toHaveCount(3);
  await dlg.getByRole("button", { name: "Done" }).click();
  const card = page.getByTestId("card-Call dad");
  await expect(card).toContainText("18:30");
  await expect(card).toContainText("📎 3");
  await expect(card.locator(".card-cover")).toHaveCount(1);
});

test("calendar: add a special day, it shows on the month and on that day", async ({ page, request }) => {
  await quietMorning(request);
  await page.goto("/calendar");
  const day = todayPrague().slice(0, 8) + "28";
  await page.getByLabel("Date").fill(day);
  await page.getByLabel("Title").fill("MOI appointment");
  await page.getByRole("button", { name: "Add special day" }).click();
  await expect(page.getByTestId("special-list")).toContainText("MOI appointment");
  await expect(page.getByTestId(`cell-${day}`)).toContainText("MOI appointment");
  await page.getByTestId(`cell-${day}`).click();
  await expect(page.getByTestId("hero")).toContainText("MOI appointment");
});

test("no broken images or console errors on any page", async ({ page, request }) => {
  await quietMorning(request);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  for (const path of ["/", "/calendar", "/boards", "/settings"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const broken = await page.$$eval("img", (imgs) =>
      imgs.filter((i) => !(i as HTMLImageElement).complete || (i as HTMLImageElement).naturalWidth === 0).map((i) => (i as HTMLImageElement).src),
    );
    expect(broken, `broken images on ${path}`).toEqual([]);
  }
  expect(errors).toEqual([]);
});
