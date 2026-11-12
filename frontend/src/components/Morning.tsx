import { useEffect, useState } from "react";
import { api, Mood, Video } from "../api";
import { MOOD_KEYS, THEMES, ThemeKey } from "../theme";
import { Modal } from "./Modal";
import { Scene } from "./Scenes";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return "Up late, Nazrin?";
  return `${h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}, Nazrin`;
};

export function MoodPicker({
  season,
  current,
  onPick,
  onClose,
}: {
  season: ThemeKey;
  current: Mood | null;
  onPick: (m: Mood | null) => void;
  onClose: () => void;
}) {
  const s = THEMES[season];
  return (
    <Modal onClose={onClose} label="How do you feel today?">
      <div className="mood-picker">
        <p className="eyebrow">{greeting()}</p>
        <h2>How do you feel today?</h2>
        <div className="moods">
          {MOOD_KEYS.map((k) => {
            const t = THEMES[k];
            return (
              <button
                key={k}
                className={`mood ${current === k ? "on" : ""}`}
                data-testid={`mood-${k}`}
                style={{ background: t.vars["--bg"], color: t.vars["--text"] }}
                onClick={() => onPick(k)}
              >
                <span className="mood-scene">
                  <Scene k={k} />
                </span>
                <span className="mood-label">
                  <strong>
                    {t.emoji} {t.name}
                  </strong>
                  <small>{t.sub}</small>
                </span>
              </button>
            );
          })}
        </div>
        <button className="ghost season-btn" data-testid="mood-season" onClick={() => onPick(null)}>
          {s.emoji} Just keep {s.name.toLowerCase()}
        </button>
      </div>
    </Modal>
  );
}

export function MotivationPlayer({ onDone, doneLabel = "Let’s go" }: { onDone: () => void; doneLabel?: string }) {
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState("");
  const [voted, setVoted] = useState<boolean | null>(null);

  const load = () => {
    setVideo(null);
    setVoted(null);
    setError("");
    api.nextVideo().then(setVideo).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const vote = (liked: boolean) => {
    if (!video) return;
    setVoted(liked);
    api.feedback(video.id, liked).catch(() => undefined);
  };

  return (
    <>
      <div className="video-frame" data-testid="video-frame">
        {!video && !error && <div className="video-loading">Finding something good…</div>}
        {error && <div className="video-loading">{error}</div>}
        {video?.source === "youtube" && (
          <iframe
            src={video.embed_url}
            title={video.title || "Motivation video"}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        )}
        {video?.source === "local" && <video src={video.video_url} autoPlay controls playsInline />}
      </div>
      <div className="video-actions">
        <button className={`vote ${voted === true ? "on" : ""}`} aria-label="I liked it" onClick={() => vote(true)} disabled={!video}>
          👍
        </button>
        <button className={`vote ${voted === false ? "on" : ""}`} aria-label="Not for me" onClick={() => vote(false)} disabled={!video}>
          👎
        </button>
        <button className="ghost" onClick={load}>
          Another one
        </button>
        {video?.source === "youtube" && (
          <a className="ghost small-link" href={video.watch_url} target="_blank" rel="noreferrer">
            Open on YouTube ↗
          </a>
        )}
        <button className="primary" onClick={onDone}>
          {doneLabel}
        </button>
      </div>
    </>
  );
}

export function MotivationModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} label="Motivation">
      <div className="motivation">
        <p className="eyebrow">Today’s fuel 🔥</p>
        <h2 className="quote">Do it tired. Do it anyway.</h2>
        <MotivationPlayer onDone={onClose} />
      </div>
    </Modal>
  );
}
