import { useEffect, useRef, useState } from "react";
import { addDays, api, Attachment, Card, todayIso } from "../api";
import { LABEL_COLORS } from "./CardFace";
import { Modal } from "./Modal";

const fmtSize = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;

export function CardModal({ card, onClose, onChanged }: { card: Card; onClose: () => void; onChanged: () => void }) {
  const [c, setC] = useState(card);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => setC(card), [card]);

  const save = async (patch: Parameters<typeof api.patchCard>[1]) => {
    setC((x) => ({ ...x, ...patch }));
    try {
      await api.patchCard(card.id, patch);
      onChanged();
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  const upload = async (files: FileList | File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError("");
    try {
      const added = await api.upload(card.id, files);
      setC((x) => ({ ...x, attachments: [...x.attachments, ...added] }));
      onChanged();
    } catch (e) {
      setError(String((e as Error).message));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a: Attachment) => {
    await api.deleteAttachment(a.id);
    setC((x) => ({ ...x, attachments: x.attachments.filter((y) => y.id !== a.id) }));
    onChanged();
  };

  return (
    <Modal onClose={onClose} label="Card details">
      <div
        className={`card-modal ${dragOver ? "drop-active" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          upload(e.dataTransfer.files);
        }}
      >
        <input
          className="title-input"
          aria-label="Card title"
          defaultValue={c.title}
          key={c.id}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== card.title) save({ title: v });
          }}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />

        <div className="field-row">
          <label>
            <span>Time</span>
            <input type="time" value={c.time ?? ""} onChange={(e) => save({ time: e.target.value || null })} />
          </label>
          <div>
            <span className="field-label">Label</span>
            <div className="swatches">
              {Object.entries(LABEL_COLORS).map(([k, v]) => (
                <button
                  key={k}
                  aria-label={`Label ${k}`}
                  className={`swatch ${c.label === k ? "on" : ""}`}
                  style={{ background: v }}
                  onClick={() => save({ label: c.label === k ? null : k })}
                />
              ))}
            </div>
          </div>
        </div>

        <label className="block">
          <span>Notes</span>
          <textarea
            rows={4}
            placeholder="Add details, links, thoughts…"
            defaultValue={c.description}
            key={`d${c.id}`}
            onBlur={(e) => e.target.value !== card.description && save({ description: e.target.value })}
          />
        </label>

        <div className="block">
          <div className="att-head">
            <span>Attachments</span>
            <button className="ghost small" onClick={() => fileInput.current?.click()} disabled={busy}>
              {busy ? "Uploading…" : "+ Add files"}
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              data-testid="file-input"
              onChange={(e) => {
                if (e.target.files) upload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          {c.attachments.length === 0 && <p className="hint">Any file type — photos, PDFs, voice notes, videos. Or drop files here.</p>}
          <div className="attachments">
            {c.attachments.map((a) => (
              <div className="att" key={a.id}>
                <AttachmentPreview a={a} />
                <div className="att-info">
                  <a href={a.url} target="_blank" rel="noreferrer" title={a.filename}>
                    {a.filename}
                  </a>
                  <span>{fmtSize(a.size)}</span>
                </div>
                <a className="icon-btn" href={`${a.url}?download=true`} aria-label="Download">
                  ⤓
                </a>
                <button className="icon-btn" aria-label={`Remove ${a.filename}`} onClick={() => remove(a)}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button
            className="ghost"
            onClick={async () => {
              await api.moveCardToDay(card.id, addDays(todayIso(), 1));
              onChanged();
              onClose();
            }}
          >
            → Move to tomorrow
          </button>
          <button
            className="danger-text"
            onClick={async () => {
              await api.deleteCard(card.id);
              onChanged();
              onClose();
            }}
          >
            Delete card
          </button>
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

function AttachmentPreview({ a }: { a: Attachment }) {
  const t = a.content_type;
  if (t.startsWith("image/")) return <img className="att-thumb" src={a.url} alt={a.filename} />;
  if (t.startsWith("video/"))
    return <video className="att-thumb video" src={a.url} poster={a.poster_url ?? undefined} controls preload="metadata" playsInline />;
  if (t.startsWith("audio/")) return <audio src={a.url} controls preload="none" className="att-audio" />;
  const ext = a.filename.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE";
  return <div className="att-thumb file-icon">{ext}</div>;
}
