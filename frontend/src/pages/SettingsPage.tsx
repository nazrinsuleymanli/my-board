import { useEffect, useState } from "react";
import { useApp } from "../App";
import { api, MorningSettings, todayIso } from "../api";
import { Scene } from "../components/Scenes";
import { enablePush, isSubscribed, pushSupport } from "../push";
import { THEMES, ThemeKey } from "../theme";

const ORDER: ThemeKey[] = ["winter", "spring", "summer", "autumn", "motivated", "hardday", "cozy", "dreamy"];

export function SettingsPage() {
  const { backgrounds, reloadBackgrounds, openMotivation } = useApp();
  const [seeds, setSeeds] = useState<{ id: string; watch_url: string }[]>([]);
  const [status, setStatus] = useState<{ youtube_enabled: boolean; local_videos: number } | null>(null);
  const [link, setLink] = useState("");
  const [msg, setMsg] = useState("");

  const loadMotivation = () => {
    api.seeds().then(setSeeds);
    api.motivationStatus().then(setStatus);
  };
  useEffect(loadMotivation, []);

  return (
    <div className="page settings">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <MorningPanel />
      <SiriPanel />

      <section className="panel">
        <h2>Theme pictures</h2>
        <p className="hint">Every season and mood has its own drawn scene. Optional: add a picture here and it replaces the scene for that theme.</p>
        <div className="theme-rows">
          {ORDER.map((k) => {
            const t = THEMES[k];
            const list = backgrounds[k] ?? [];
            return (
              <div className="theme-row" key={k}>
                <div className="theme-swatch" style={{ background: t.vars["--bg"], color: t.vars["--text"] }}>
                  <Scene k={k} />
                  <span>{t.emoji}</span>
                  <strong>{t.name}</strong>
                </div>
                <div className="thumbs">
                  {list.map((b) => (
                    <div className="thumb" key={b.name}>
                      <img src={b.url} alt="" loading="lazy" />
                      {b.removable && (
                        <button
                          className="icon-btn"
                          aria-label="Remove photo"
                          onClick={async () => (await api.deleteBackground(b.name), reloadBackgrounds())}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <label className="thumb add">
                    +
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (f) {
                          await api.uploadBackground(k, f);
                          reloadBackgrounds();
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Motivation videos</h2>
        <p className="hint">
          {status?.youtube_enabled
            ? "YouTube suggestions are ON — new Shorts similar to your favourites, tuned by your 👍 / 👎."
            : "YouTube suggestions are OFF (no API key yet — see README). Your favourites and your own vlogs are used meanwhile."}
          {status ? ` · ${status.local_videos} own vlogs` : ""}
        </p>
        <h3>Favourites (the algorithm learns from these)</h3>
        <ul className="seed-list">
          {seeds.map((s) => (
            <li key={s.id}>
              <a href={s.watch_url} target="_blank" rel="noreferrer">
                youtube.com/shorts/{s.id}
              </a>
              <button className="icon-btn" aria-label="Remove" onClick={async () => (await api.removeSeed(s.id), loadMotivation())}>
                ✕
              </button>
            </li>
          ))}
        </ul>
        <form
          className="row"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              setSeeds(await api.addSeed(link));
              setLink("");
              setMsg("");
            } catch (err) {
              setMsg((err as Error).message);
            }
          }}
        >
          <input placeholder="Paste a YouTube link" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="primary" type="submit">
            Add
          </button>
        </form>
        {msg && <p className="error">{msg}</p>}
        <div className="row gap">
          <label className="ghost upload-btn">
            Upload a vlog
            <input
              type="file"
              accept="video/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setMsg("Uploading…");
                  await api.uploadVideo(f);
                  setMsg("Uploaded ✓ (iPhone .mov plays best in Safari)");
                  loadMotivation();
                }
                e.target.value = "";
              }}
            />
          </label>
          <button className="ghost" onClick={openMotivation}>
            Watch one now
          </button>
        </div>
      </section>
    </div>
  );
}

const SUPPORT_HINT: Record<string, string> = {
  insecure: "Notifications need the app to be opened over HTTPS (see README → “Morning message on your phone”).",
  "not-installed": "On iPhone: tap Share → Add to Home Screen, open my board from the Home Screen, then come back here.",
  unsupported: "This browser can’t receive push notifications.",
  denied: "Notifications are blocked — allow them in iPhone Settings → Notifications → my board.",
};

function MorningPanel() {
  const [s, setS] = useState<MorningSettings | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [msg, setMsg] = useState("");
  const support = pushSupport();

  useEffect(() => {
    api.morningSettings().then(setS);
    isSubscribed().then(setSubscribed);
  }, []);

  const save = async (patch: Partial<MorningSettings>) => {
    if (!s) return;
    setS(await api.setMorningSettings({ ...s, ...patch }));
  };

  return (
    <section className="panel" data-testid="morning-panel">
      <h2>Morning & evening messages</h2>
      <p className="hint">
        ☀️ Morning: “Halaldır sənə” + a quote + a positive ♓ line → tap → today’s video. 🌙 Evening: your şükür ritual.
      </p>
      {s && (
        <>
          <div className="row gap morning-row">
            <label className="toggle">
              <input type="checkbox" checked={s.enabled} onChange={(e) => save({ enabled: e.target.checked })} />
              <span>☀️ Morning at</span>
            </label>
            <input type="time" value={s.time} onChange={(e) => e.target.value && save({ time: e.target.value })} aria-label="Morning time" />
          </div>
          <div className="row gap morning-row">
            <label className="toggle">
              <input type="checkbox" checked={s.evening_enabled} onChange={(e) => save({ evening_enabled: e.target.checked })} />
              <span>🌙 Evening at</span>
            </label>
            <input
              type="time"
              value={s.evening_time}
              onChange={(e) => e.target.value && save({ evening_time: e.target.value })}
              aria-label="Evening time"
            />
            <span className="hint">({s.timezone} · {s.devices} device{s.devices === 1 ? "" : "s"})</span>
          </div>
        </>
      )}
      <div className="row gap">
        {support.ok ? (
          <button
            className="primary"
            onClick={async () => {
              try {
                await enablePush();
                setSubscribed(true);
                setMsg("This device will get the morning message ✓");
                api.morningSettings().then(setS);
              } catch (e) {
                setMsg((e as Error).message);
              }
            }}
          >
            {subscribed ? "✓ On for this device" : "Turn on for this device"}
          </button>
        ) : (
          <p className="hint" data-testid="push-hint">{SUPPORT_HINT[support.reason]}</p>
        )}
        <button
          className="ghost"
          onClick={async () => {
            try {
              const r = await api.pushTestKind(todayIso(), "morning");
              setMsg(r.sent ? "Sent! Check your phone 📱" : "Couldn’t reach the device — try turning it on again.");
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Test ☀️
        </button>
        <button
          className="ghost"
          onClick={async () => {
            try {
              const r = await api.pushTestKind(todayIso(), "evening");
              setMsg(r.sent ? "Sent! Check your phone 📱" : "Couldn’t reach the device — try turning it on again.");
            } catch (e) {
              setMsg((e as Error).message);
            }
          }}
        >
          Test 🌙
        </button>
        <a className="ghost" href="/morning">
          Preview the morning page
        </a>
      </div>
      {msg && <p className="hint">{msg}</p>}
    </section>
  );
}

function SiriPanel() {
  const base = window.location.origin;
  const [copied, setCopied] = useState(false);
  const url = `${base}/api/quick/task`;
  return (
    <section className="panel siri" data-testid="siri-panel">
      <h2>“Hey Siri, add task” 🗣</h2>
      <p className="hint">One-time setup in the iPhone Shortcuts app (2 min). Works from the lock screen, because it only talks to your own server.</p>
      <div className="row">
        <code className="url-box">{url}</code>
        <button className="ghost" onClick={() => navigator.clipboard?.writeText(url).then(() => setCopied(true))}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <ol className="steps">
        <li>
          Shortcuts → <b>+</b> → name it <b>Add task</b> (that’s what you’ll say to Siri).
        </li>
        <li>
          Add action <b>Dictate Text</b> (Language: English or Turkish · Stop listening: After Pause).
        </li>
        <li>
          Add <b>Get Contents of URL</b> → paste the address above → <b>Method: POST</b> → <b>Request Body: JSON</b> → add field <b>text</b> = <i>Dictated Text</i>.
        </li>
        <li>
          Add <b>Speak Text</b> → <i>Contents of URL</i>. Siri will say “Əlavə etdim: …”.
        </li>
        <li>
          Try it: <b>“Hey Siri, add task”</b> → “call dad at six”. It lands in today’s To Do.
        </li>
      </ol>
      {!base.startsWith("https") && (
        <p className="hint">⚠️ Use the https://…ts.net address from Tailscale here (README §3), so it also works away from home Wi-Fi.</p>
      )}
    </section>
  );
}
