import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../App";
import { api, Halal, parseIso, todayIso, Win } from "../api";
import { Particles, Scene } from "../components/Scenes";

const AZ_MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun", "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const AZ_DAYS = ["Bazar", "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə"];
// Browsers often ship without Azerbaijani date names, so format by hand.
const azDate = (s: string) => {
  const d = parseIso(s);
  return `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}, ${AZ_DAYS[d.getDay()]}`;
};

/** 🌅 Morning block: real evidence from yesterday + one sentence in her own words. */
export function HalalCard({ day }: { day: string }) {
  const [h, setH] = useState<Halal | null>(null);
  useEffect(() => {
    api.halal(day).then(setH).catch(() => undefined);
  }, [day]);
  if (!h) return null;
  const empty = !h.done.length && !h.proud && !h.moments.length;
  return (
    <section className="halal" data-testid="halal">
      <div className="halal-head">
        <h2>Halaldır sənə 💛</h2>
        {h.streak.current > 0 && <span className="streak-pill">🔥 {h.streak.current} gün ardıcıl</span>}
      </div>
      {empty ? (
        <p className="halal-soft">Dünən sakit bir gün idi — bu da olur. Dincəlmək də irəliləməyin bir hissəsidir. Bu gün təzə səhifədir. 🌱</p>
      ) : (
        <>
          {h.done.length > 0 && (
            <div className="halal-block">
              <p className="halal-label">Dünən bitirdiyin {h.done.length} iş</p>
              <ul className="done-list">
                {h.done.slice(0, 6).map((t, i) => (
                  <li key={i}>✓ {t}</li>
                ))}
                {h.done.length > 6 && <li className="more-li">və daha {h.done.length - 6}…</li>}
              </ul>
            </div>
          )}
          {h.moments.length > 0 && (
            <div className="moment-strip">
              {h.moments.map((m, i) => (
                <figure key={i} title={m.card}>
                  <img src={m.url} alt={m.card} />
                  {m.video && <span className="play-badge">▶</span>}
                </figure>
              ))}
            </div>
          )}
          {h.proud && (
            <blockquote className="halal-proud">
              <span>Dünən özün yazdın:</span> “{h.proud}”
            </blockquote>
          )}
        </>
      )}
      {h.affirmation && (
        <p className="affirmation" data-testid="affirmation">
          ✨ {h.affirmation}
        </p>
      )}
    </section>
  );
}

/** 🌙 Evening ritual: 3 şükür, 1 thing I did well, tomorrow's main task, then the dua. */
export function RitualPage() {
  const day = todayIso();
  const { theme } = useApp();
  const [g, setG] = useState(["", "", ""]);
  const [proud, setProud] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [saved, setSaved] = useState(false);
  const [dua, setDua] = useState("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    api.reflection(day).then((r) => {
      setG(r.gratitude);
      setProud(r.proud);
      setTomorrow(r.tomorrow_task);
      setSaved(r.done);
    });
    api.dua().then((d) => setDua(d.text));
    api.streak(day).then((s) => setStreak(s.current)).catch(() => undefined);
  }, [day]);

  const save = async () => {
    await api.saveReflection(day, { gratitude: g, proud, tomorrow_task: tomorrow });
    setSaved(true);
    api.streak(day).then((s) => setStreak(s.current));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="page ritual-page" data-testid="ritual-page">
      <section className="ritual-card">
        <Particles k={theme.key} />
        <div className="ritual-art">
          <Scene k="dreamy" />
        </div>
        <div className="ritual-body">
          <p className="eyebrow">{azDate(day)}</p>
          {saved ? (
            <div className="ritual-done" data-testid="ritual-done">
              <h1>Şükür 🤲</h1>
              {streak > 0 && <p className="streak-pill big">🔥 {streak} gün ardıcıl</p>}
              <p className="dua">{dua}</p>
              <p className="halal-soft">Bu gün kifayət qədər etdin. Gecən xeyrə qalsın, Nazrin 🌙</p>
              <button className="ghost" onClick={() => setSaved(false)}>
                Yazdıqlarıma bax / dəyiş
              </button>
            </div>
          ) : (
            <>
              <h1>Axşamın xeyir 🌙</h1>
              <label className="ritual-q">
                <span>Bu gün nəyə görə şükür edirsən?</span>
                {g.map((v, i) => (
                  <input
                    key={i}
                    value={v}
                    placeholder={["Ailəm sağ-salamatdır…", "Günəşli bir gün idi…", "Dadlı bir çay içdim…"][i]}
                    onChange={(e) => setG(g.map((x, j) => (j === i ? e.target.value : x)))}
                    aria-label={`Şükür ${i + 1}`}
                  />
                ))}
              </label>
              <label className="ritual-q">
                <span>Bu gün özündə nəyi bəyəndin? Nəyi yaxşı etdin?</span>
                <textarea
                  rows={2}
                  value={proud}
                  placeholder="Yorğun olsam da dərsə oturdum…"
                  onChange={(e) => setProud(e.target.value)}
                  aria-label="Bu gün yaxşı etdiyim"
                />
              </label>
              <label className="ritual-q">
                <span>Sabah üçün 1 əsas iş</span>
                <input
                  value={tomorrow}
                  placeholder="Tezisin girişini yaz"
                  onChange={(e) => setTomorrow(e.target.value)}
                  aria-label="Sabah üçün əsas iş"
                />
                <small>Sabahın board-unda ən yuxarıda olacaq.</small>
              </label>
              <button className="primary big-btn" onClick={save} disabled={!g.some((x) => x.trim()) && !proud.trim()}>
                Yadda saxla və dua et 🤲
              </button>
            </>
          )}
        </div>
      </section>
      <aside className="ritual-side">
        <Link to="/wins" className="ritual-link">
          📔 <strong>Uğurlar dəftəri</strong>
          <span>Çətin günlərdə oxumaq üçün — yazdığın bütün yaxşı şeylər</span>
        </Link>
        <Link to="/morning" className="ritual-link">
          🌅 <strong>Səhər səhifəsi</strong>
          <span>Halaldır sənə + bu günün videosu</span>
        </Link>
      </aside>
    </div>
  );
}

/** 📔 Uğurlar dəftəri + "Özüm haqqında" sentences + her dua. */
export function WinsPage() {
  const [wins, setWins] = useState<Win[] | null>(null);
  const [affs, setAffs] = useState<{ id: number; text: string }[]>([]);
  const [newAff, setNewAff] = useState("");
  const [dua, setDua] = useState("");
  const [duaSaved, setDuaSaved] = useState(false);

  useEffect(() => {
    api.wins().then(setWins);
    api.affirmations().then(setAffs);
    api.dua().then((d) => setDua(d.text));
  }, []);

  return (
    <div className="page wins-page" data-testid="wins-page">
      <header className="page-head">
        <h1>Uğurlar dəftəri 📔</h1>
      </header>
      <div className="wins-layout">
        <div className="wins-list">
          {wins?.length === 0 && (
            <p className="hint">Hələ boşdur. Bu axşam şükür ritualını et — ilk səhifə burada açılacaq. 🌙</p>
          )}
          {wins?.map((w) => (
            <article key={w.day} className="win">
              <p className="eyebrow">{azDate(w.day)}</p>
              {w.proud && <p className="win-proud">💛 {w.proud}</p>}
              {w.gratitude.length > 0 && (
                <p className="win-grat">
                  🤲 {w.gratitude.join(" · ")}
                </p>
              )}
              {w.finished.length > 0 && (
                <p className="win-done">
                  ✓ {w.finished.length} iş bitirdin: {w.finished.slice(0, 4).join(", ")}
                  {w.finished.length > 4 ? "…" : ""}
                </p>
              )}
            </article>
          ))}
        </div>
        <aside className="panel">
          <h2>Özüm haqqında ✨</h2>
          <p className="hint">Hər səhər bunlardan biri göstərilir. Öz sözlərinlə yaz — doğru olduğunu bildiyin şeyləri.</p>
          <ul className="aff-list" data-testid="aff-list">
            {affs.map((a) => (
              <li key={a.id}>
                <span>{a.text}</span>
                <button className="icon-btn" aria-label="Sil" onClick={async () => (await api.deleteAffirmation(a.id), setAffs(affs.filter((x) => x.id !== a.id)))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <form
            className="row"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newAff.trim()) return;
              setAffs(await api.addAffirmation(newAff.trim()));
              setNewAff("");
            }}
          >
            <input placeholder="Mən…" value={newAff} onChange={(e) => setNewAff(e.target.value)} aria-label="Yeni cümlə" />
            <button className="primary" type="submit">
              Əlavə et
            </button>
          </form>
          <h2 className="dua-title">Şükür duam 🤲</h2>
          <textarea rows={6} value={dua} onChange={(e) => (setDua(e.target.value), setDuaSaved(false))} aria-label="Dua" />
          <div className="row gap">
            <button className="ghost" onClick={async () => (await api.saveDua(dua), setDuaSaved(true))}>
              {duaSaved ? "✓ Yadda saxlandı" : "Duanı yadda saxla"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
