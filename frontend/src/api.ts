export type Attachment = {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  url: string;
  poster_url: string | null;
};
export type Card = {
  id: number;
  list_id: number;
  title: string;
  description: string;
  time: string | null;
  label: string | null;
  position: number;
  carried_from: string | null;
  attachments: Attachment[];
};
export type List = { id: number; title: string; position: number; is_done: boolean; cards: Card[] };
export type Board = { id: number; title: string; kind: "daily" | "custom"; day: string | null; lists: List[] };
export type BoardSummary = { id: number; title: string; card_count: number };
export type Mood = "motivated" | "hardday" | "cozy" | "dreamy";
export type DayState = { day: string; mood: Mood | null; mood_asked: boolean; video_shown: boolean };
export type Special = { id: number; day: string; title: string; kind: "event" | "motivation"; color: string };
export type Today = {
  state: DayState;
  special_days_today: Special[];
  upcoming: Special[];
  motivation_day: boolean;
  should_ask_mood: boolean;
  should_show_video: boolean;
  month_needs_specials: boolean;
};
export type MonthView = {
  month: string;
  days: Record<string, { total: number; done: number; mood: Mood | null; ritual: boolean }>;
  special_days: Special[];
  motivation_month: boolean;
};
export type Background = { name: string; url: string; removable: boolean };
export type Backgrounds = Record<string, Background[]>;
export type Video =
  | { source: "youtube"; id: string; title: string; embed_url: string; watch_url: string }
  | { source: "local"; id: string; title: string; video_url: string };

export type MorningSettings = {
  enabled: boolean;
  time: string;
  evening_enabled: boolean;
  evening_time: string;
  timezone: string;
  devices: number;
};
export type Streak = { current: number; today_counted: boolean; best: number };
export type Halal = {
  yesterday: string;
  done: string[];
  moments: { card: string; url: string; video?: boolean }[];
  proud: string;
  gratitude: string[];
  affirmation: string | null;
  streak: Streak;
  line: string;
};
export type Reflection = { day: string; gratitude: string[]; proud: string; tomorrow_task: string; done: boolean };
export type Win = Reflection & { finished: string[] };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function req<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: body && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const j = await res.json();
      msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, msg);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const files = (list: File[] | FileList, field = "files") => {
  const fd = new FormData();
  Array.from(list).forEach((f) => fd.append(field, f));
  return fd;
};

export const api = {
  dailyBoard: (day: string, isToday: boolean) => req<Board>("GET", `/api/days/${day}/board?is_today=${isToday}`),
  board: (id: number) => req<Board>("GET", `/api/boards/${id}`),
  boards: () => req<BoardSummary[]>("GET", "/api/boards"),
  createBoard: (title: string) => req<Board>("POST", "/api/boards", { title }),
  renameBoard: (id: number, title: string) => req<Board>("PATCH", `/api/boards/${id}`, { title }),
  deleteBoard: (id: number) => req<void>("DELETE", `/api/boards/${id}`),
  layout: (boardId: number, lists: { id: number; card_ids: number[] }[]) =>
    req<Board>("PUT", `/api/boards/${boardId}/layout`, { lists }),

  addList: (boardId: number, title: string) => req<List>("POST", `/api/boards/${boardId}/lists`, { title }),
  patchList: (id: number, patch: Partial<Pick<List, "title" | "is_done">>) => req<List>("PATCH", `/api/lists/${id}`, patch),
  deleteList: (id: number) => req<void>("DELETE", `/api/lists/${id}`),

  addCard: (listId: number, title: string, extra: Partial<Pick<Card, "time" | "label" | "description">> = {}) =>
    req<Card>("POST", `/api/lists/${listId}/cards`, { title, ...extra }),
  patchCard: (id: number, patch: Partial<Pick<Card, "title" | "description" | "time" | "label">>) =>
    req<Card>("PATCH", `/api/cards/${id}`, patch),
  deleteCard: (id: number) => req<void>("DELETE", `/api/cards/${id}`),
  moveCardToDay: (id: number, day: string) => req<Card>("POST", `/api/cards/${id}/move-to-day`, { day }),
  upload: (cardId: number, list: File[] | FileList) => req<Attachment[]>("POST", `/api/cards/${cardId}/attachments`, files(list)),
  deleteAttachment: (id: number) => req<void>("DELETE", `/api/attachments/${id}`),

  today: (day: string) => req<Today>("GET", `/api/today?day=${day}`),
  setState: (day: string, patch: Partial<Omit<DayState, "day">>) => req<DayState>("PUT", `/api/days/${day}/state`, patch),
  month: (ym: string) => req<MonthView>("GET", `/api/calendar/${ym}`),
  setMonth: (ym: string, motivation_month: boolean) => req("PUT", `/api/months/${ym}`, { motivation_month }),
  addSpecial: (s: Omit<Special, "id">) => req<Special>("POST", "/api/special-days", s),
  deleteSpecial: (id: number) => req<void>("DELETE", `/api/special-days/${id}`),

  backgrounds: () => req<Backgrounds>("GET", "/api/backgrounds"),
  uploadBackground: (key: string, file: File) => req<Backgrounds>("POST", `/api/backgrounds/${key}`, files([file], "file")),
  deleteBackground: (name: string) => req<void>("DELETE", `/api/backgrounds/${name}`),
  videos: () => req<{ id: string; url: string }[]>("GET", "/api/videos"),
  uploadVideo: (file: File) => req("POST", "/api/videos", files([file], "file")),

  nextVideo: () => req<Video>("GET", "/api/motivation/next"),
  feedback: (video_id: string, liked: boolean) => req("POST", "/api/motivation/feedback", { video_id, liked }),
  seeds: () => req<{ id: string; watch_url: string }[]>("GET", "/api/motivation/seeds"),
  addSeed: (url: string) => req<{ id: string; watch_url: string }[]>("POST", "/api/motivation/seeds", { url }),
  removeSeed: (id: string) => req<void>("DELETE", `/api/motivation/seeds/${id}`),
  morning: (day: string) =>
    req<{ day: string; greeting: string; quote: string; pisces: string }>("GET", `/api/morning?day=${day}&hour=${new Date().getHours()}`),
  pushKey: () => req<{ public_key: string }>("GET", "/api/push/key"),
  pushSubscribe: (sub: PushSubscriptionJSON) => req("POST", "/api/push/subscribe", sub),
  pushTest: (day: string) => req<{ sent: number; removed: number; failed: number }>("POST", `/api/push/test?day=${day}`),
  morningSettings: () => req<MorningSettings>("GET", "/api/settings/morning"),
  setMorningSettings: (s: Partial<MorningSettings> & { enabled: boolean; time: string }) =>
    req<MorningSettings>("PUT", "/api/settings/morning", s),
  pushTestKind: (day: string, kind: "morning" | "evening") =>
    req<{ sent: number; removed: number; failed: number }>("POST", `/api/push/test?day=${day}&kind=${kind}`),

  halal: (day: string) => req<Halal>("GET", `/api/halal?day=${day}`),
  streak: (day: string) => req<Streak>("GET", `/api/streak?day=${day}`),
  reflection: (day: string) => req<Reflection>("GET", `/api/reflections/${day}`),
  saveReflection: (day: string, r: Pick<Reflection, "gratitude" | "proud" | "tomorrow_task">) =>
    req<Reflection>("PUT", `/api/reflections/${day}`, r),
  wins: () => req<Win[]>("GET", "/api/wins"),
  affirmations: () => req<{ id: number; text: string }[]>("GET", "/api/affirmations"),
  addAffirmation: (text: string) => req<{ id: number; text: string }[]>("POST", "/api/affirmations", { text }),
  deleteAffirmation: (id: number) => req<void>("DELETE", `/api/affirmations/${id}`),
  dua: () => req<{ text: string; is_default: boolean }>("GET", "/api/dua"),
  saveDua: (text: string) => req<{ text: string; is_default: boolean }>("PUT", "/api/dua", { text }),
  motivationStatus: () => req<{ youtube_enabled: boolean; local_videos: number }>("GET", "/api/motivation/status"),
};

// ---- dates (always the phone's local date, never UTC) ----
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const todayIso = () => iso(new Date());
export const parseIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = parseIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
};
