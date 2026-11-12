import { APIRequestContext, expect, Locator, Page } from "@playwright/test";

export const todayPrague = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Prague" }).format(new Date()); // YYYY-MM-DD

/** Skip the morning mood question + video so tests start on a quiet board. */
export async function quietMorning(request: APIRequestContext) {
  await request.put(`/api/days/${todayPrague()}/state`, { data: { mood_asked: true, video_shown: true } });
}

/** A fresh custom board with cards: { "To Do": [...], "In Progress": [...], "Done": [...] } */
export async function makeBoard(request: APIRequestContext, title: string, cards: Record<string, string[]>) {
  const b = await (await request.post("/api/boards", { data: { title } })).json();
  for (const l of b.lists) {
    for (const t of cards[l.title] ?? []) await request.post(`/api/lists/${l.id}/cards`, { data: { title: t } });
  }
  return b.id as number;
}

export async function boardState(request: APIRequestContext, id: number) {
  const b = await (await request.get(`/api/boards/${id}`)).json();
  return Object.fromEntries(b.lists.map((l: any) => [l.title, l.cards.map((c: any) => c.title)])) as Record<string, string[]>;
}
export async function columnOrder(request: APIRequestContext, id: number) {
  const b = await (await request.get(`/api/boards/${id}`)).json();
  return b.lists.map((l: any) => l.title) as string[];
}

/** Human-like mouse drag (dnd-kit needs a few px of movement to start). */
export async function mouseDrag(page: Page, from: Locator, to: Locator, opts: { toYOffset?: number } = {}) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 8, a.y + a.height / 2 + 8, { steps: 4 });
  const tx = b.x + b.width / 2;
  const ty = opts.toYOffset !== undefined ? b.y + opts.toYOffset : b.y + b.height / 2;
  await page.mouse.move(tx, ty, { steps: 20 });
  await page.waitForTimeout(120);
  await page.mouse.move(tx + 1, ty + 1, { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

export async function cardsIn(page: Page, column: string) {
  const t = await page.getByTestId(`column-${column}`).locator(".card .card-title").allInnerTexts();
  return t.map((s) => s.replace(/^✓/, "").trim());
}

export async function expectColumns(page: Page, expected: Record<string, string[]>) {
  for (const [col, titles] of Object.entries(expected)) {
    await expect.poll(() => cardsIn(page, col)).toEqual(titles);
  }
}
