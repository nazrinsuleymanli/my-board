import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../App";
import { api, todayIso } from "../api";
import { MotivationPlayer } from "../components/Morning";
import { Particles, Scene } from "../components/Scenes";
import { HalalCard } from "./RitualPage";

/** Where the morning notification lands: quote + ♓ line + today's motivation video. */
export function MorningPage() {
  const nav = useNavigate();
  const day = todayIso();
  const { theme, today, openMoodPicker, refreshToday } = useApp();
  const [msg, setMsg] = useState<{ greeting: string; quote: string; pisces: string } | null>(null);

  useEffect(() => {
    api.morning(day).then(setMsg);
    api.setState(day, { video_shown: true }).then(refreshToday).catch(() => undefined);
  }, [day, refreshToday]);

  const startDay = () => {
    nav("/");
    if (today?.should_ask_mood) openMoodPicker();
  };

  return (
    <div className="page morning-page" data-testid="morning-page">
      <section className="morning-card">
        <Particles k={theme.key} />
        <div className="morning-art">
          <Scene k={theme.key} />
        </div>
        <div className="morning-text">
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>{msg?.greeting ?? "Good morning"} ☀️</h1>
          <blockquote data-testid="morning-quote">{msg?.quote}</blockquote>
          <p className="pisces" data-testid="morning-pisces">
            {msg?.pisces}
          </p>
        </div>
      </section>
      <HalalCard day={day} />
      <section className="morning-video">
        <MotivationPlayer onDone={startDay} doneLabel="Start my day →" />
      </section>
    </div>
  );
}
