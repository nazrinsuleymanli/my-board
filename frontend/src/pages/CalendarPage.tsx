import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../App";
import { api, iso, MonthView, parseIso, Special, todayIso } from "../api";
import { LABEL_COLORS } from "../components/CardFace";
import { THEMES } from "../theme";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarPage() {
  const nav = useNavigate();
  const { refreshToday } = useApp();
  const today = todayIso();
  const [ym, setYm] = useState(today.slice(0, 7));
  const [data, setData] = useState<MonthView | null>(null);

  const load = useCallback(() => {
    api.month(ym).then(setData);
  }, [ym]);
  useEffect(load, [load]);

  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(y, m - 1, i + 1))),
  ];
  while (cells.length % 7) cells.push(null);

  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setYm(iso(d).slice(0, 7));
  };

  const byDay: Record<string, Special[]> = {};
  data?.special_days.forEach((s) => (byDay[s.day] ??= []).push(s));
  const changed = () => (load(), refreshToday());

  return (
    <div className="page calendar-page">
      <header className="page-head">
        <button className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}>
          ‹
        </button>
        <h1>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h1>
        <button className="icon-btn" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
        {ym !== today.slice(0, 7) && (
          <button className="pill-link" onClick={() => setYm(today.slice(0, 7))}>
            this month
          </button>
        )}
      </header>

      <div className="calendar-layout">
        <div className="calendar" data-testid="calendar">
          {WEEKDAYS.map((w) => (
            <div key={w} className="weekday">
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} className="cell empty" />;
            const info = data?.days[d];
            const sp = byDay[d] ?? [];
            return (
              <button
                key={d}
                className={`cell ${d === today ? "today" : ""} ${d < today ? "past" : ""}`}
                onClick={() => nav(d === today ? "/" : `/day/${d}`)}
                data-testid={`cell-${d}`}
              >
                <span className="num">
                  {parseIso(d).getDate()}
                  <span className="cell-icons">
                    {info?.ritual && <span title="Şükür ritualı">✨</span>}
                    {info?.mood && <span className="mood-dot" title={THEMES[info.mood].name}>{THEMES[info.mood].emoji}</span>}
                  </span>
                </span>
                {sp.slice(0, 2).map((s) => (
                  <span key={s.id} className="pill" style={{ background: LABEL_COLORS[s.color] }}>
                    {s.kind === "motivation" ? "🔥 " : ""}
                    {s.title}
                  </span>
                ))}
                {sp.length > 2 && <span className="more">+{sp.length - 2}</span>}
                {info && info.total > 0 && (
                  <span className="mini-progress" title={`${info.done}/${info.total} done`}>
                    <span style={{ width: `${(info.done / info.total) * 100}%` }} />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <aside className="side-panel">
          <h2>Special days</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={!!data?.motivation_month}
              onChange={async (e) => {
                await api.setMonth(ym, e.target.checked);
                changed();
              }}
            />
            <span>🔥 Motivation month — show a video every morning</span>
          </label>
          <SpecialForm ym={ym} onAdded={changed} />
          <ul className="special-list" data-testid="special-list">
            {data?.special_days.length === 0 && <li className="hint">Nothing yet for this month.</li>}
            {data?.special_days.map((s) => (
              <li key={s.id}>
                <i style={{ background: LABEL_COLORS[s.color] }} />
                <span className="sd-date">{parseIso(s.day).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                <span className="sd-title">
                  {s.kind === "motivation" && "🔥 "}
                  {s.title}
                </span>
                <button className="icon-btn" aria-label={`Delete ${s.title}`} onClick={async () => (await api.deleteSpecial(s.id), changed())}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

function SpecialForm({ ym, onAdded }: { ym: string; onAdded: () => void }) {
  const defaultDay = todayIso().startsWith(ym) ? todayIso() : `${ym}-01`;
  const [day, setDay] = useState(defaultDay);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"event" | "motivation">("event");
  const [color, setColor] = useState("rose");
  useEffect(() => setDay(defaultDay), [defaultDay]);

  return (
    <form
      className="special-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        await api.addSpecial({ day, title: title.trim(), kind, color });
        setTitle("");
        onAdded();
      }}
    >
      <input type="date" value={day} onChange={(e) => setDay(e.target.value)} aria-label="Date" required />
      <input placeholder="e.g. MOI appointment" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Title" />
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value as "event" | "motivation")} aria-label="Kind">
          <option value="event">Event</option>
          <option value="motivation">🔥 Motivation day</option>
        </select>
        <div className="swatches">
          {Object.entries(LABEL_COLORS).map(([k, v]) => (
            <button
              type="button"
              key={k}
              aria-label={`Color ${k}`}
              className={`swatch ${color === k ? "on" : ""}`}
              style={{ background: v }}
              onClick={() => setColor(k)}
            />
          ))}
        </div>
      </div>
      <button className="primary" type="submit">
        Add special day
      </button>
    </form>
  );
}
