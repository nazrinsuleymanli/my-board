import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { quietMorning } from "./helpers";

const dir = mkdtempSync(join(tmpdir(), "moments-"));
function makeMedia() {
  const mov = join(dir, "IMG_4242.MOV"); // like an iPhone video: HEVC in a .mov
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=3",
    "-f", "lavfi", "-i", "sine=duration=3", "-c:v", "libx265", "-tag:v", "hvc1", "-c:a", "aac", "-shortest", mov]);
  const jpg = join(dir, "IMG_4243.jpg");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1200x900", "-frames:v", "1", jpg]);
  return { mov, jpg };
}

test.beforeEach(async ({ request }) => quietMorning(request));

test("📸 photo moment lands on today's board with the photo as cover", async ({ page }) => {
  const { jpg } = makeMedia();
  await page.goto("/");
  await page.getByTestId("moment-btn").click();
  await page.getByTestId("moment-file").setInputFiles(jpg);
  await expect(page.getByTestId("moment-capture").locator("img")).toBeVisible();
  await page.getByLabel("Caption").fill("Reading at Café Podnebí");
  await page.getByRole("button", { name: "Add to board" }).click();
  const card = page.getByTestId("card-Reading at Café Podnebí");
  await expect(card).toBeVisible();
  await expect(page.getByTestId("column-In Progress")).toContainText("Reading at Café Podnebí");
  const img = card.locator(".card-cover img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await expect(card.locator(".card-meta")).toContainText(/\d\d:\d\d/); // time of the moment
});

test("🎬 iPhone video moment: converted, poster on card, plays in the card", async ({ page }) => {
  const { mov } = makeMedia();
  await page.goto("/");
  await page.getByTestId("moment-btn").click();
  await page.getByTestId("moment-file").setInputFiles(mov);
  await page.getByLabel("Caption").fill("Gym — leg day");
  await page.getByRole("button", { name: "Add to board" }).click();
  const card = page.getByTestId("card-Gym — leg day");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.locator(".play-badge")).toBeVisible();
  await expect.poll(() => card.locator(".card-cover img").evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
  await card.click();
  const video = page.getByRole("dialog", { name: "Card details" }).locator("video");
  await expect(video).toHaveAttribute("src", /\/api\/attachments\/\d+\/file/);
  await expect(page.getByRole("dialog")).toContainText("IMG_4242.mp4");
  const res = await page.request.get((await video.getAttribute("src"))!);
  expect(res.headers()["content-type"]).toBe("video/mp4");
  // H.264 is what Safari/iPhone and Chrome play; Playwright's own Chromium build has no H.264,
  // so only check playback when the browser says it can.
  const canPlay = await video.evaluate((v: HTMLVideoElement) => v.canPlayType('video/mp4; codecs="avc1.42E01E"'));
  if (canPlay) await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
});
