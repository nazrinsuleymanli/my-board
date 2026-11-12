import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useApp } from "../App";
import { addDays, api, Board as BoardT, Card, parseIso, Special, Streak, todayIso } from "../api";
import { Board } from "../components/Board";
import { CardModal } from "../components/CardModal";
import { LABEL_COLORS } from "../components/CardFace";
import { MomentModal } from "../components/MomentModal";
import { Particles, Scene } from "../components/Scenes";

export function DayPage() {
  const params = useParams();
  const nav = useNavigate();
  const today = todayIso();
  const day = params.day ?? today;
  const isToday = day === today;
  const { theme, photo, today: info, openMoodPicker, openMotivation } = useApp();
  const [board, setBoard] = useState<BoardT | null>(null);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [daySpecials, setDaySpecials] = useState<Special[]>([]);
  const [moment, setMoment] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [ritualDone, setRitualDone] = useState(true);
  useEffect(() => {
    if (!isToday) return;
    api.streak(day).then(setStreak).catch(() => undefined);
    api.reflection(day).then((r) => setRitualDone(r.done)).catch(() => undefined);
  }, [day, isToday, board]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api
      .dailyBoard(day, isToday)
      .then((b) => (setBoard(b), setError("")))
      .catch((e) => setError(e.message));
  }, [day, isToday]);
  useEffect(load, [load]);

  useEffect(() => {
    if (isToday) return;
    api.today(day).then((t) => setDaySpecials(t.special_days_today)).catch(() => undefined);
  }, [day, isToday]);

  const d = parseIso(day);
  const specials = isToday ? info?.special_days_today ?? [] : daySpecials;
  const total = board?.lists.reduce((n, l) => n + l.cards.length, 0) ?? 0;
  const done = board?.lists.filter((l) => l.is_done).reduce((n, l) => n + l.cards.length, 0) ?? 0;

  return (
    <div className="page">
      <header className="hero" data-testid="hero">
        <Particles k={theme.key} />
        <div className="hero-text">
          <div className="day-nav">
            <button className="icon-btn" aria-label="Previous day" onClick={() => nav(`/day/${addDays(day, -1)}`)}>
              ‹
            </button>
            <span className="eyebrow">
              {isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "long" })}
            </span>
            <button className="icon-btn" aria-label="Next day" onClick={() => nav(`/day/${addDays(day, 1)}`)}>
              ›
            </button>
            {!isToday && (
              <Link className="pill-link" to="/">
                back to today
              </Link>
            )}
          </div>
          <h1 className="hero-title">
            {d.toLocaleDateString(undefined, isToday ? { weekday: "long", day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" })}
          </h1>
          {isToday && <p className="hero-quote">{theme.quote}</p>}
          <div className="chips">
            {isToday && (
              <button className="chip" onClick={openMoodPicker} data-testid="mood-chip">
                {theme.emoji} {theme.name} <span className="chip-sub">· change</span>
              </button>
            )}
            {isToday && streak && streak.current > 0 && (
              <span className="chip streak-chip" data-testid="streak-chip" title={`Ən uzun: ${streak.best} gün`}>
                🔥 {streak.current} gün
              </span>
            )}
            {isToday && !ritualDone && new Date().getHours() >= 18 && (
              <Link className="chip" to="/ritual" data-testid="ritual-chip">
                🌙 Şükür ritualı
              </Link>
            )}
            {isToday && info?.motivation_day && (
              <button className="chip" onClick={openMotivation}>
                🔥 Motivation day — watch
              </button>
            )}
            {specials.map((s) => (
              <span key={s.id} className="chip special" style={{ borderColor: LABEL_COLORS[s.color] }}>
                <i style={{ background: LABEL_COLORS[s.color] }} />
                {s.title}
              </span>
            ))}
            {total > 0 && (
              <span className="chip progress-chip">
                {done}/{total} done
                <span className="bar">
                  <span style={{ width: `${(done / total) * 100}%` }} />
                </span>
              </span>
            )}
          </div>
          {isToday && info && info.upcoming.length > 0 && (
            <p className="upcoming">
              Coming up:{" "}
              {info.upcoming.map((u, i) => (
                <span key={u.id}>
                  {i > 0 && " · "}
                  {u.title} <em>{parseIso(u.day).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</em>
                </span>
              ))}
            </p>
          )}
        </div>
        <div className="hero-art">{photo ? <img src={photo} alt="" className="custom-art" /> : <Scene k={theme.key} />}</div>
      </header>

      {isToday && info?.month_needs_specials && (
        <Link to="/calendar" className="banner" data-testid="month-banner">
          ✿ New month! Add this month’s special days — appointments, birthdays, exams →
        </Link>
      )}

      {error && <p className="error">Couldn’t load the board: {error}</p>}
      {board && <Board board={board} onBoardChange={setBoard} onOpenCard={setOpenCard} reload={load} />}
      {board && (
        <button className="fab" onClick={() => setMoment(true)} aria-label="Add a moment" data-testid="moment-btn">
          📸 <span>Moment</span>
        </button>
      )}
      {moment && board && <MomentModal board={board} onClose={() => setMoment(false)} onSaved={load} />}
      {openCard && (
        <CardModal
          card={board?.lists.flatMap((l) => l.cards).find((c) => c.id === openCard.id) ?? openCard}
          onClose={() => setOpenCard(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
