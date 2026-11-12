import { useEffect, useMemo, useState } from "react";
import { api, Board } from "../api";
import { Modal } from "./Modal";

/** 📸 Capture what you're doing right now: a photo or short video + one line -> a card on today's board. */
export function MomentModal({ board, onClose, onSaved }: { board: Board; onClose: () => void; onSaved: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const defaultList = board.lists.find((l) => l.title.toLowerCase() === "in progress") ?? board.lists.find((l) => !l.is_done) ?? board.lists[0];
  const [listId, setListId] = useState(defaultList?.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);
  const isVideo = !!file && (file.type.startsWith("video/") || /\.(mov|mp4|m4v)$/i.test(file.name));

  const save = async () => {
    if (!listId || (!file && !caption.trim())) return;
    setBusy(true);
    setError("");
    try {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const card = await api.addCard(listId, caption.trim() || (isVideo ? "🎬 Moment" : "📸 Moment"), { time });
      if (file) await api.upload(card.id, [file]);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} label="Moment">
      <div className="moment">
        <p className="eyebrow">Right now</p>
        <h2>What are you doing?</h2>
        <label className={`capture ${file ? "has-file" : ""}`} data-testid="moment-capture">
          {!file && (
            <span className="capture-empty">
              <span className="capture-icon">📸</span>
              Take a photo or a short video
              <small>or pick one from your gallery</small>
            </span>
          )}
          {file && preview && (isVideo ? <video src={preview} playsInline muted autoPlay loop /> : <img src={preview} alt="" />)}
          <input
            type="file"
            accept="image/*,video/*"
            hidden
            data-testid="moment-file"
            onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
          />
        </label>
        <input
          className="moment-caption"
          placeholder="Studying PA195 at the library…"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          aria-label="Caption"
        />
        <div className="row">
          <select value={listId} onChange={(e) => setListId(Number(e.target.value))} aria-label="Column">
            {board.lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
          <button className="primary" onClick={save} disabled={busy || (!file && !caption.trim())}>
            {busy ? (isVideo ? "Saving video…" : "Saving…") : "Add to board"}
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </div>
    </Modal>
  );
}
