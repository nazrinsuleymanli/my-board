import { Card, parseIso } from "../api";

export const LABEL_COLORS: Record<string, string> = {
  rose: "#D3968C",
  moss: "#839958",
  teal: "#2d8a8f",
  amber: "#E6A04B",
  lilac: "#a99be0",
  sky: "#6fa8dc",
};

const shortDate = (s: string) => parseIso(s).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function CardFace({ card, done }: { card: Card; done: boolean }) {
  const media = card.attachments.find((a) => a.content_type.startsWith("image/") || a.poster_url);
  const isVideo = !!media && !media.content_type.startsWith("image/");
  const files = card.attachments.length;
  return (
    <>
      {media && (
        <div className="card-cover">
          <img src={isVideo ? media.poster_url! : media.url} alt="" draggable={false} loading="lazy" />
          {isVideo && <span className="play-badge">▶</span>}
        </div>
      )}
      {card.label && <span className="label-bar" style={{ background: LABEL_COLORS[card.label] }} />}
      <div className="card-title">
        {done && <span className="check">✓</span>}
        {card.title}
      </div>
      {(card.time || files > 0 || card.description || card.carried_from) && (
        <div className="card-meta">
          {card.time && <span title="Time">◷ {card.time}</span>}
          {card.description && <span title="Has notes">≡</span>}
          {files > 0 && <span title="Attachments">📎 {files}</span>}
          {card.carried_from && (
            <span className="carried" title="Carried over from an earlier day">
              ↻ {shortDate(card.carried_from)}
            </span>
          )}
        </div>
      )}
    </>
  );
}
