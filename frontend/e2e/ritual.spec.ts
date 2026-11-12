import { expect, test } from "@playwright/test";
import { quietMorning, todayPrague } from "./helpers";

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

test.beforeEach(async ({ request }) => quietMorning(request));

test("🌙 evening ritual → dua, streak, tomorrow's task on top of tomorrow, ✨ in calendar, entry in Uğurlar dəftəri", async ({ page, request }) => {
  const today = todayPrague();
  await page.goto("/ritual");
  await expect(page.getByRole("button", { name: /Yadda saxla/ })).toBeDisabled();
  await page.getByLabel("Şükür 1").fill("Ailəm sağdır");
  await page.getByLabel("Şükür 2").fill("Dadlı çay");
  await page.getByLabel("Bu gün yaxşı etdiyim").fill("Yorğun olsam da dərsə oturdum");
  await page.getByLabel("Sabah üçün əsas iş").fill("Tezisin girişini yaz");
  await page.getByRole("button", { name: /Yadda saxla/ }).click();
  const done = page.getByTestId("ritual-done");
  await expect(done).toContainText("Şükür");
  await expect(done).toContainText("Allahım"); // default dua
  await expect(done).toContainText(/🔥 \d+ gün ardıcıl/); // ritual day counts for the streak
  await expect(page.locator(".ritual-body .eyebrow")).toHaveText(/^\d{1,2} (Yanvar|Fevral|Mart|Aprel|May|İyun|İyul|Avqust|Sentyabr|Oktyabr|Noyabr|Dekabr), /);

  const tm = await (await request.get(`/api/days/${addDays(today, 1)}/board`)).json();
  expect(tm.lists[0].cards[0].title).toBe("Tezisin girişini yaz");

  await page.goto("/calendar");
  await expect(page.getByTestId(`cell-${today}`)).toContainText("✨");

  await page.goto("/wins");
  await expect(page.getByTestId("wins-page")).toContainText("Yorğun olsam da dərsə oturdum");
  await page.getByLabel("Yeni cümlə").fill("Mən yaxşı mühəndisəm.");
  await page.getByRole("button", { name: "Əlavə et" }).click();
  await expect(page.getByTestId("aff-list")).toContainText("Mən yaxşı mühəndisəm.");
});

test("🌅 morning shows 'Halaldır sənə' with yesterday's real wins", async ({ page, request }) => {
  const y = addDays(todayPrague(), -1);
  const b = await (await request.get(`/api/days/${y}/board`)).json();
  for (const t of ["Gym", "PA195 homework"]) await request.post(`/api/lists/${b.lists[2].id}/cards`, { data: { title: t } });
  await request.put(`/api/reflections/${y}`, { data: { gratitude: ["anam"], proud: "Kafka tapşırığını bitirdim", tomorrow_task: "" } });
  await page.goto("/morning");
  const h = page.getByTestId("halal");
  await expect(h).toContainText("Halaldır sənə");
  await expect(h).toContainText("Gym");
  await expect(h).toContainText("PA195 homework");
  await expect(h).toContainText("Kafka tapşırığını bitirdim");
  await expect(page.getByTestId("affirmation")).not.toBeEmpty();
  await page.goto("/");
  await expect(page.getByTestId("streak-chip")).toContainText("gün");
});

test("🗣 Siri endpoint adds a task and answers in plain text", async ({ page, request }) => {
  const r = await request.post("/api/quick/task", { data: { text: "atama zəng et" } });
  expect(await r.text()).toBe("Əlavə etdim: atama zəng et");
  await page.goto("/");
  await expect(page.getByTestId("column-To Do")).toContainText("Atama zəng et");
  await page.goto("/settings");
  await expect(page.getByTestId("siri-panel")).toContainText("/api/quick/task");
});
