import type { Mood } from "./api";

export type ThemeKey = "winter" | "spring" | "summer" | "autumn" | Mood;

export type Theme = {
  key: ThemeKey;
  name: string;
  emoji: string;
  heading: "serif" | "script";
  quote: string;
  sub: string;
  vars: Record<string, string>;
};

const base = (v: {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  card: string;
  cardText: string;
  glass: string;
  border: string;
  meta: string;
}) => ({
  "--bg": v.bg,
  "--text": v.text,
  "--muted": v.muted,
  "--accent": v.accent,
  "--accent-2": v.accent2,
  "--card": v.card,
  "--card-text": v.cardText,
  "--glass": v.glass,
  "--border": v.border,
  "--meta": v.meta,
});

export const THEMES: Record<ThemeKey, Theme> = {
  // Seasons (default for each month)
  winter: {
    key: "winter",
    name: "Winter lights",
    emoji: "❄️",
    heading: "serif",
    quote: "Warm lights, pink sweaters, slow mornings.",
    sub: "December–February",
    vars: base({
      bg: "radial-gradient(1100px 560px at 85% -10%, rgba(242,196,109,.24), transparent 60%), radial-gradient(900px 520px at 0% 100%, rgba(244,182,200,.22), transparent 60%), linear-gradient(165deg, #241430 0%, #3d2347 50%, #64436f 100%)",
      text: "#FBF4FA",
      muted: "#D9C3DD",
      accent: "#F2C46D",
      accent2: "#F4B6C8",
      card: "#FFF8FB",
      cardText: "#3a1f3d",
      glass: "rgba(255,240,250,.09)",
      border: "rgba(255,240,250,.18)",
      meta: "#8a6a8a",
    }),
  },

  spring: {
    key: "spring",
    name: "Lotus pond",
    emoji: "🪷",
    heading: "serif",
    quote: "Bloom where you are.",
    sub: "March–May",
    vars: base({
      bg: "radial-gradient(1000px 520px at 90% 0%, rgba(211,150,140,.30), transparent 60%), radial-gradient(800px 500px at 0% 100%, rgba(131,153,88,.28), transparent 60%), linear-gradient(160deg, #0A3323 0%, #0d4436 45%, #105666 100%)",
      text: "#F7F4D5",
      muted: "#C3CDA6",
      accent: "#D3968C",
      accent2: "#839958",
      card: "#F7F4D5",
      cardText: "#0A3323",
      glass: "rgba(247,244,213,.09)",
      border: "rgba(247,244,213,.18)",
      meta: "#5c7350",
    }),
  },
  summer: {
    key: "summer",
    name: "Lake summer",
    emoji: "☀️",
    heading: "serif",
    quote: "Blue skies, linen days, big plans.",
    sub: "June–August",
    vars: base({
      bg: "radial-gradient(900px 500px at 100% 0%, rgba(255,224,138,.22), transparent 60%), radial-gradient(900px 600px at 0% 100%, rgba(61,107,58,.35), transparent 60%), linear-gradient(170deg, #173f78 0%, #1f5a7a 50%, #24646a 100%)",
      text: "#F3F8FC",
      muted: "#BCD3E6",
      accent: "#FFD66B",
      accent2: "#E8A87C",
      card: "#FFFDF7",
      cardText: "#173a5c",
      glass: "rgba(255,255,255,.1)",
      border: "rgba(255,255,255,.2)",
      meta: "#5c7690",
    }),
  },

  autumn: {
    key: "autumn",
    name: "Golden autumn",
    emoji: "🍂",
    heading: "serif",
    quote: "Golden leaves, one task at a time.",
    sub: "September–November",
    vars: base({
      bg: "radial-gradient(1000px 520px at 90% -5%, rgba(233,185,73,.30), transparent 60%), radial-gradient(800px 500px at 0% 100%, rgba(157,176,184,.18), transparent 60%), linear-gradient(160deg, #2a2316 0%, #43361d 55%, #5f4a25 100%)",
      text: "#FAF1DE",
      muted: "#DCCB9F",
      accent: "#E9B949",
      accent2: "#A9BCC4",
      card: "#FCF6EA",
      cardText: "#3b2f17",
      glass: "rgba(255,244,214,.08)",
      border: "rgba(255,244,214,.17)",
      meta: "#8a7650",
    }),
  },

  // Moods (chosen in the morning, override the season for that day)
  motivated: {
    key: "motivated",
    name: "Motivated",
    emoji: "🔥",
    heading: "serif",
    quote: "Do it tired. Do it anyway.",
    sub: "Discipline over motivation",
    vars: base({
      bg: "radial-gradient(700px 420px at 88% 0%, rgba(224,168,90,.30), transparent 65%), radial-gradient(600px 400px at 0% 100%, rgba(224,168,90,.10), transparent 60%), linear-gradient(170deg, #14110e 0%, #211a14 60%, #2d221a 100%)",
      text: "#F3E9DC",
      muted: "#BCA98F",
      accent: "#E0A85A",
      accent2: "#C9B79C",
      card: "#EFE6D8",
      cardText: "#241c15",
      glass: "rgba(243,233,220,.06)",
      border: "rgba(243,233,220,.14)",
      meta: "#7d6a55",
    }),
  },
  hardday: {
    key: "hardday",
    name: "Hard day",
    emoji: "🌸",
    heading: "serif",
    quote: "Some days are heavier. Small steps still count.",
    sub: "Be gentle with yourself",
    vars: base({
      bg: "radial-gradient(900px 500px at 85% 0%, rgba(242,184,207,.28), transparent 60%), linear-gradient(180deg, #1b3253 0%, #2c5684 60%, #5d88b8 100%)",
      text: "#F6F2F7",
      muted: "#C9D9EE",
      accent: "#F2B8CF",
      accent2: "#A8E0D0",
      card: "#FFF8FB",
      cardText: "#1d3557",
      glass: "rgba(255,255,255,.1)",
      border: "rgba(255,255,255,.2)",
      meta: "#6d7f99",
    }),
  },
  cozy: {
    key: "cozy",
    name: "Cozy",
    emoji: "🍵",
    heading: "serif",
    quote: "Tea first. Then everything else.",
    sub: "Slow and warm",
    vars: base({
      bg: "radial-gradient(800px 480px at 85% 0%, rgba(255,214,170,.22), transparent 60%), linear-gradient(175deg, #8c3c40 0%, #a9585c 45%, #6e1f24 100%)",
      text: "#FFF4EC",
      muted: "#F3D2C9",
      accent: "#F0B35A",
      accent2: "#9DBA7E",
      card: "#FFF6EF",
      cardText: "#4a1a1e",
      glass: "rgba(255,240,230,.1)",
      border: "rgba(255,240,230,.2)",
      meta: "#8f5b5e",
    }),
  },
  dreamy: {
    key: "dreamy",
    name: "Dreamy",
    emoji: "💭",
    heading: "script",
    quote: "Soft light, quiet heart.",
    sub: "A little nostalgic",
    vars: base({
      bg: "radial-gradient(700px 520px at 75% 10%, rgba(233,216,180,.20), transparent 65%), linear-gradient(180deg, #0e0e10 0%, #1a1815 65%, #2f271d 100%)",
      text: "#F1E6D0",
      muted: "#B3A68F",
      accent: "#E9D8B4",
      accent2: "#9FB4C7",
      card: "#F5EEDF",
      cardText: "#1d1a17",
      glass: "rgba(241,230,208,.06)",
      border: "rgba(241,230,208,.14)",
      meta: "#7c705c",
    }),
  },
};

export const MOOD_KEYS: Mood[] = ["motivated", "hardday", "cozy", "dreamy"];

export function seasonOf(d: Date): ThemeKey {
  const m = d.getMonth(); // 0 = Jan
  if (m === 11 || m <= 1) return "winter";
  if (m <= 4) return "spring";
  if (m <= 7) return "summer";
  return "autumn";
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  Object.entries(t.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  root.dataset.heading = t.heading;
  root.dataset.theme = t.key;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", STATUS_BAR[t.key]);
}

const STATUS_BAR: Record<ThemeKey, string> = {
  winter: "#241430",
  spring: "#0A3323",
  summer: "#173f78",
  autumn: "#2a2316",
  motivated: "#14110e",
  hardday: "#1b3253",
  cozy: "#8c3c40",
  dreamy: "#0e0e10",
};
