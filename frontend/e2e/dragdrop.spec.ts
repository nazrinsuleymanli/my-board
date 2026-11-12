import { expect, test } from "@playwright/test";
import { boardState, columnOrder, expectColumns, makeBoard, mouseDrag, quietMorning } from "./helpers";

test.beforeEach(async ({ request }) => quietMorning(request));

test("drag a card to another column — persists after reload", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-1", { "To Do": ["Alpha", "Beta"], Done: ["Gamma"] });
  await page.goto(`/boards/${id}`);
  await mouseDrag(page, page.getByTestId("card-Alpha"), page.getByTestId("card-Gamma"), { toYOffset: 4 });
  await expectColumns(page, { "To Do": ["Beta"], Done: ["Alpha", "Gamma"] });
  await expect.poll(() => boardState(request, id)).toEqual({ "To Do": ["Beta"], "In Progress": [], Done: ["Alpha", "Gamma"] });
  await page.reload();
  await expectColumns(page, { "To Do": ["Beta"], Done: ["Alpha", "Gamma"] });
});

test("drag a card into an EMPTY column", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-2", { "To Do": ["Solo"] });
  await page.goto(`/boards/${id}`);
  await mouseDrag(page, page.getByTestId("card-Solo"), page.getByTestId("column-In Progress").locator(".empty-drop"));
  await expectColumns(page, { "To Do": [], "In Progress": ["Solo"] });
  await expect.poll(() => boardState(request, id)).toEqual({ "To Do": [], "In Progress": ["Solo"], Done: [] });
});

test("reorder cards inside one column", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-3", { "To Do": ["One", "Two", "Three"] });
  await page.goto(`/boards/${id}`);
  await mouseDrag(page, page.getByTestId("card-Three"), page.getByTestId("card-One"), { toYOffset: 3 });
  await expectColumns(page, { "To Do": ["Three", "One", "Two"] });
  await expect.poll(async () => (await boardState(request, id))["To Do"]).toEqual(["Three", "One", "Two"]);
});

test("drag a whole column by its header", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-4", { Done: ["finished thing"] });
  await page.goto(`/boards/${id}`);
  const doneHead = page.getByTestId("column-Done").locator(".column-head h3");
  const todoHead = page.getByTestId("column-To Do").locator(".column-head h3");
  await mouseDrag(page, doneHead, todoHead);
  await expect.poll(() => columnOrder(request, id)).toEqual(["Done", "To Do", "In Progress"]);
  await page.reload();
  await expect(page.locator(".column-head h3")).toHaveText(["✓Done", "To Do", "In Progress"]);
});

test("a short click opens the card (does not drag)", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-5", { "To Do": ["Clicky"] });
  await page.goto(`/boards/${id}`);
  await page.getByTestId("card-Clicky").click();
  await expect(page.getByRole("dialog", { name: "Card details" })).toBeVisible();
  await expect.poll(() => boardState(request, id)).toEqual({ "To Do": ["Clicky"], "In Progress": [], Done: [] });
});

test("dropping outside the board puts the card back", async ({ page, request }) => {
  const id = await makeBoard(request, "dnd-6", { "To Do": ["Stay"] });
  await page.goto(`/boards/${id}`);
  const card = page.getByTestId("card-Stay");
  const a = (await card.boundingBox())!;
  await page.mouse.move(a.x + 20, a.y + 10);
  await page.mouse.down();
  await page.mouse.move(a.x + 40, a.y + 40, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expectColumns(page, { "To Do": ["Stay"] });
});
