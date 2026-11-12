import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, Board as BoardT, BoardSummary, Card } from "../api";
import { Board } from "../components/Board";
import { CardModal } from "../components/CardModal";

export function BoardsPage() {
  const nav = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[] | null>(null);
  const [title, setTitle] = useState("");
  useEffect(() => {
    api.boards().then(setBoards);
  }, []);
  return (
    <div className="page">
      <header className="page-head">
        <h1>Boards</h1>
      </header>
      <p className="hint lead">Daily boards live under Today & Month. Make your own boards here for bigger things — thesis, job hunt, trips.</p>
      <div className="board-grid">
        {boards?.map((b) => (
          <Link key={b.id} to={`/boards/${b.id}`} className="board-tile">
            <strong>{b.title}</strong>
            <span>{b.card_count} cards</span>
          </Link>
        ))}
        <form
          className="board-tile new"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const b = await api.createBoard(title.trim());
            nav(`/boards/${b.id}`);
          }}
        >
          <input placeholder="New board name" value={title} onChange={(e) => setTitle(e.target.value)} />
          <button className="primary" type="submit">
            Create
          </button>
        </form>
      </div>
    </div>
  );
}

export function BoardPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const [board, setBoard] = useState<BoardT | null>(null);
  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(() => {
    api.board(id).then(setBoard);
  }, [id]);
  useEffect(load, [load]);

  if (!board) return <div className="page" />;
  return (
    <div className="page">
      <header className="page-head">
        <Link to="/boards" className="icon-btn" aria-label="All boards">
          ‹
        </Link>
        <input
          className="board-title-input"
          defaultValue={board.title}
          key={board.id}
          aria-label="Board title"
          onBlur={(e) => e.target.value.trim() && e.target.value !== board.title && api.renameBoard(id, e.target.value.trim()).then(setBoard)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <span className="spacer" />
        {confirm ? (
          <>
            <button className="danger" onClick={async () => (await api.deleteBoard(id), nav("/boards"))}>
              Delete board
            </button>
            <button className="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="danger-text" onClick={() => setConfirm(true)}>
            Delete
          </button>
        )}
      </header>
      <Board board={board} onBoardChange={setBoard} onOpenCard={setOpenCard} reload={load} />
      {openCard && (
        <CardModal
          card={board.lists.flatMap((l) => l.cards).find((c) => c.id === openCard.id) ?? openCard}
          onClose={() => setOpenCard(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
