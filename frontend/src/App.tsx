import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { api, Backgrounds, Mood, Today, todayIso } from "./api";
import { MoodPicker, MotivationModal } from "./components/Morning";
import { BoardPage, BoardsPage } from "./pages/BoardsPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DayPage } from "./pages/DayPage";
import { MorningPage } from "./pages/MorningPage";
import { RitualPage, WinsPage } from "./pages/RitualPage";
import { SettingsPage } from "./pages/SettingsPage";
import { applyTheme, seasonOf, Theme, THEMES, ThemeKey } from "./theme";

type Ctx = {
  theme: Theme;
  season: ThemeKey;
  photo: string | null;
  today: Today | null;
  refreshToday: () => Promise<Today | undefined>;
  openMoodPicker: () => void;
  openMotivation: () => void;
  backgrounds: Backgrounds;
  reloadBackgrounds: () => void;
};
const AppCtx = createContext<Ctx>(null!);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const day = todayIso();
  const season = seasonOf(new Date());
  const [today, setToday] = useState<Today | null>(null);
  const [backgrounds, setBackgrounds] = useState<Backgrounds>({});
  const [picker, setPicker] = useState(false);
  const [video, setVideo] = useState(false);

  const refreshToday = useCallback(async () => {
    try {
      const t = await api.today(day);
      setToday(t);
      return t;
    } catch {
      return undefined;
    }
  }, [day]);
  const reloadBackgrounds = useCallback(() => {
    api.backgrounds().then(setBackgrounds).catch(() => undefined);
  }, []);

  // Morning flow: ask mood once a day -> then motivation video if it's a motivated / motivation day.
  useEffect(() => {
    reloadBackgrounds();
    refreshToday().then((t) => {
      if (!t || ["/morning", "/ritual"].includes(window.location.pathname)) return; // these pages have their own flow
      if (t.should_ask_mood) setPicker(true);
      else if (t.should_show_video) setVideo(true);
    });
  }, [refreshToday, reloadBackgrounds]);

  const mood = today?.state.mood ?? null;
  const theme = THEMES[mood ?? season];
  useEffect(() => applyTheme(theme), [theme]);

  // one random photo per theme per app-open (mood photos fall back to the season's)
  const [seed] = useState(() => Math.random());
  const photo = useMemo(() => {
    const pool = (mood && backgrounds[mood]?.length ? backgrounds[mood] : backgrounds[season]) ?? [];
    return pool.length ? pool[Math.floor(seed * pool.length)].url : null;
  }, [backgrounds, mood, season, seed]);

  const pickMood = async (m: Mood | null) => {
    setPicker(false);
    await api.setState(day, { mood: m, mood_asked: true });
    const t = await refreshToday();
    if (t?.should_show_video) setVideo(true);
  };

  const ctx: Ctx = {
    theme,
    season,
    photo,
    today,
    refreshToday,
    openMoodPicker: () => setPicker(true),
    openMotivation: () => setVideo(true),
    backgrounds,
    reloadBackgrounds,
  };

  return (
    <AppCtx.Provider value={ctx}>
      <BrowserRouter>
        <div className="app">
          <nav className="nav">
            <div className="brand">
              <span className="brand-mark" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              my board
            </div>
            <NavLink to="/" end>
              <span>☀</span>Today
            </NavLink>
            <NavLink to="/calendar">
              <span>▦</span>Month
            </NavLink>
            <NavLink to="/boards">
              <span>▤</span>Boards
            </NavLink>
            <NavLink to="/ritual">
              <span>☾</span>Ritual
            </NavLink>
            <NavLink to="/settings">
              <span>✿</span>Settings
            </NavLink>
          </nav>
          <main className="main">
            <Routes>
              <Route path="/" element={<DayPage key="today" />} />
              <Route path="/day/:day" element={<DayPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/boards" element={<BoardsPage />} />
              <Route path="/boards/:id" element={<BoardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/morning" element={<MorningPage />} />
              <Route path="/ritual" element={<RitualPage />} />
              <Route path="/wins" element={<WinsPage />} />
            </Routes>
          </main>
        </div>
        {picker && (
          <MoodPicker
            season={season}
            current={mood}
            onPick={pickMood}
            onClose={() => {
              setPicker(false);
              if (!today?.state.mood_asked) api.setState(day, { mood_asked: true }).then(refreshToday);
            }}
          />
        )}
        {video && (
          <MotivationModal
            onClose={() => {
              setVideo(false);
              api.setState(day, { video_shown: true }).then(refreshToday);
            }}
          />
        )}
      </BrowserRouter>
    </AppCtx.Provider>
  );
}
