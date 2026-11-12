"""Boards, lists, cards, attachments, daily boards (with carry-over of unfinished cards)."""
import mimetypes
import os
import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .db import UPLOAD_DIR, get_db
from .models import Attachment, Board, BoardList, Card
from .video import make_poster, normalize_video

router = APIRouter(prefix="/api")

MAX_UPLOAD_MB = int(os.environ.get("MAX_UPLOAD_MB", "200"))
DEFAULT_LISTS = [("To Do", False), ("In Progress", False), ("Done", True)]
LABELS = {"rose", "moss", "teal", "amber", "lilac", "sky", None}


# ---------- serialization ----------

def attachment_out(a: Attachment) -> dict:
    return {
        "id": a.id,
        "filename": a.filename,
        "content_type": a.content_type,
        "size": a.size,
        "url": f"/api/attachments/{a.id}/file",
        "poster_url": f"/api/attachments/{a.id}/poster" if a.poster_name else None,
    }


def card_out(c: Card) -> dict:
    return {
        "id": c.id,
        "list_id": c.list_id,
        "title": c.title,
        "description": c.description,
        "time": c.time,
        "label": c.label,
        "position": c.position,
        "carried_from": c.carried_from.isoformat() if c.carried_from else None,
        "attachments": [attachment_out(a) for a in c.attachments],
    }


def board_out(b: Board) -> dict:
    return {
        "id": b.id,
        "title": b.title,
        "kind": b.kind,
        "day": b.day.isoformat() if b.day else None,
        "lists": [
            {
                "id": l.id,
                "title": l.title,
                "position": l.position,
                "is_done": l.is_done,
                "cards": [card_out(c) for c in l.cards],
            }
            for l in b.lists
        ],
    }


# ---------- helpers ----------

def _get(db: Session, model, id_: int):
    obj = db.get(model, id_)
    if not obj:
        raise HTTPException(404, f"{model.__name__} {id_} not found")
    return obj


def _new_board(db: Session, title: str, kind: str, day: date | None = None) -> Board:
    b = Board(title=title, kind=kind, day=day)
    for i, (t, done) in enumerate(DEFAULT_LISTS):
        b.lists.append(BoardList(title=t, position=i, is_done=done))
    db.add(b)
    db.flush()
    return b


def carry_over(db: Session, target: Board) -> int:
    """Move unfinished cards from earlier daily boards into `target`. Returns count moved."""
    rows = db.execute(
        select(Card, BoardList, Board)
        .join(BoardList, Card.list_id == BoardList.id)
        .join(Board, BoardList.board_id == Board.id)
        .where(Board.kind == "daily", Board.day < target.day, BoardList.is_done.is_(False))
        .order_by(Board.day, BoardList.position, Card.position)
    ).all()
    by_title = {l.title.lower(): l for l in target.lists if not l.is_done}
    first = next((l for l in target.lists if not l.is_done), target.lists[0])
    for card, lst, board in rows:
        dest = by_title.get(lst.title.lower(), first)
        card.carried_from = card.carried_from or board.day
        card.list_id = dest.id
        card.position = len(dest.cards)
        dest.cards.append(card)
    target.carry_done = True
    return len(rows)


def get_or_create_daily(db: Session, day: date, is_today: bool) -> Board:
    b = db.scalar(select(Board).where(Board.day == day))
    if not b:
        b = _new_board(db, day.strftime("%A, %d %B"), "daily", day)
    if is_today:  # every open of today's board pulls in anything left unfinished on earlier days
        carry_over(db, b)
    db.commit()
    db.refresh(b)
    return b


# ---------- schemas ----------

class TitleIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ListPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    is_done: bool | None = None


class CardIn(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str = ""
    time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")
    label: str | None = None


class CardPatch(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=500)
    description: str | None = None
    time: str | None = Field(None, pattern=r"^(\d{2}:\d{2})?$")
    label: str | None = None


class LayoutList(BaseModel):
    id: int
    card_ids: list[int]


class LayoutIn(BaseModel):
    lists: list[LayoutList]


class MoveToDayIn(BaseModel):
    day: date


# ---------- routes: boards ----------

@router.get("/days/{day}/board")
def daily_board(day: date, is_today: bool = False, db: Session = Depends(get_db)):
    return board_out(get_or_create_daily(db, day, is_today))


@router.get("/boards")
def list_boards(db: Session = Depends(get_db)):
    boards = db.scalars(select(Board).where(Board.kind == "custom").order_by(Board.created_at)).all()
    return [{"id": b.id, "title": b.title, "card_count": sum(len(l.cards) for l in b.lists)} for b in boards]


@router.post("/boards", status_code=201)
def create_board(body: TitleIn, db: Session = Depends(get_db)):
    b = _new_board(db, body.title.strip(), "custom")
    db.commit()
    db.refresh(b)
    return board_out(b)


@router.get("/boards/{board_id}")
def get_board(board_id: int, db: Session = Depends(get_db)):
    return board_out(_get(db, Board, board_id))


@router.patch("/boards/{board_id}")
def rename_board(board_id: int, body: TitleIn, db: Session = Depends(get_db)):
    b = _get(db, Board, board_id)
    b.title = body.title.strip()
    db.commit()
    return board_out(b)


@router.delete("/boards/{board_id}", status_code=204)
def delete_board(board_id: int, db: Session = Depends(get_db)):
    b = _get(db, Board, board_id)
    if b.kind == "daily":
        raise HTTPException(400, "Daily boards can't be deleted")
    _delete_files_for_board(b)
    db.delete(b)
    db.commit()


@router.put("/boards/{board_id}/layout")
def set_layout(board_id: int, body: LayoutIn, db: Session = Depends(get_db)):
    """Atomic re-order after a drag & drop: full list order + card order per list."""
    b = _get(db, Board, board_id)
    lists = {l.id: l for l in b.lists}
    cards = {c.id: c for l in b.lists for c in l.cards}
    sent_lists = [x.id for x in body.lists]
    sent_cards = [cid for x in body.lists for cid in x.card_ids]
    if sorted(sent_lists) != sorted(lists) or sorted(sent_cards) != sorted(cards):
        raise HTTPException(409, "Layout out of date — reload the board")
    for li, item in enumerate(body.lists):
        lists[item.id].position = li
        for ci, cid in enumerate(item.card_ids):
            cards[cid].list_id = item.id
            cards[cid].position = ci
    db.commit()
    db.expire_all()
    return board_out(db.get(Board, board_id))


# ---------- routes: lists ----------

@router.post("/boards/{board_id}/lists", status_code=201)
def add_list(board_id: int, body: TitleIn, db: Session = Depends(get_db)):
    b = _get(db, Board, board_id)
    l = BoardList(title=body.title.strip(), position=len(b.lists))
    b.lists.append(l)
    db.commit()
    return {"id": l.id, "title": l.title, "position": l.position, "is_done": l.is_done, "cards": []}


@router.patch("/lists/{list_id}")
def patch_list(list_id: int, body: ListPatch, db: Session = Depends(get_db)):
    l = _get(db, BoardList, list_id)
    if body.title is not None:
        l.title = body.title.strip()
    if body.is_done is not None:
        l.is_done = body.is_done
    db.commit()
    return {"id": l.id, "title": l.title, "position": l.position, "is_done": l.is_done}


@router.delete("/lists/{list_id}", status_code=204)
def delete_list(list_id: int, db: Session = Depends(get_db)):
    l = _get(db, BoardList, list_id)
    for c in l.cards:
        _delete_files_for_card(c)
    board = l.board
    db.delete(l)
    db.flush()
    for i, other in enumerate(sorted((x for x in board.lists if x.id != list_id), key=lambda x: x.position)):
        other.position = i
    db.commit()


# ---------- routes: cards ----------

@router.post("/lists/{list_id}/cards", status_code=201)
def add_card(list_id: int, body: CardIn, db: Session = Depends(get_db)):
    l = _get(db, BoardList, list_id)
    if body.label not in LABELS:
        raise HTTPException(422, "Unknown label")
    c = Card(title=body.title.strip(), description=body.description, time=body.time or None,
             label=body.label, position=len(l.cards))
    l.cards.append(c)
    db.commit()
    db.refresh(c)
    return card_out(c)


@router.patch("/cards/{card_id}")
def patch_card(card_id: int, body: CardPatch, db: Session = Depends(get_db)):
    c = _get(db, Card, card_id)
    data = body.model_dump(exclude_unset=True)
    if "label" in data and data["label"] not in LABELS:
        raise HTTPException(422, "Unknown label")
    for k, v in data.items():
        if k == "title":
            v = v.strip()
        if k == "time":
            v = v or None
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return card_out(c)


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: int, db: Session = Depends(get_db)):
    c = _get(db, Card, card_id)
    _delete_files_for_card(c)
    l = c.board_list
    db.delete(c)
    db.flush()
    for i, other in enumerate(x for x in l.cards if x.id != card_id):
        other.position = i
    db.commit()


@router.post("/cards/{card_id}/move-to-day")
def move_card_to_day(card_id: int, body: MoveToDayIn, db: Session = Depends(get_db)):
    """e.g. 'move to tomorrow' — goes to the same-named column of that day's board."""
    c = _get(db, Card, card_id)
    src = c.board_list
    target_board = db.scalar(select(Board).where(Board.day == body.day)) or _new_board(
        db, body.day.strftime("%A, %d %B"), "daily", body.day
    )
    dest = next((l for l in target_board.lists if l.title.lower() == src.title.lower()), target_board.lists[0])
    for i, other in enumerate(x for x in src.cards if x.id != c.id):
        other.position = i
    c.position = len(dest.cards)
    c.board_list = dest  # re-parent (not remove(), which would delete the orphan)
    db.commit()
    db.refresh(c)
    return card_out(c)


# ---------- routes: attachments ----------

@router.post("/cards/{card_id}/attachments", status_code=201)
async def upload_attachments(card_id: int, files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    c = _get(db, Card, card_id)
    out = []
    for f in files:
        stored = uuid.uuid4().hex + os.path.splitext(f.filename or "")[1][:10]
        path = UPLOAD_DIR / stored
        size = 0
        with open(path, "wb") as fh:
            while chunk := await f.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_MB * 1024 * 1024:
                    fh.close()
                    path.unlink(missing_ok=True)
                    raise HTTPException(413, f"{f.filename} is larger than {MAX_UPLOAD_MB} MB")
                fh.write(chunk)
        name = f.filename or stored
        ctype = f.content_type or mimetypes.guess_type(name)[0] or "application/octet-stream"
        poster = None
        if ctype.startswith("video/") or path.suffix.lower() in {".mov", ".m4v", ".hevc"}:
            path = await run_in_threadpool(normalize_video, path)
            if path.suffix.lower() == ".mp4":
                ctype = "video/mp4"
                name = os.path.splitext(name)[0] + ".mp4"
                stored = path.name
                size = path.stat().st_size
            p = await run_in_threadpool(make_poster, path)
            poster = p.name if p else None
        a = Attachment(filename=name, stored_name=stored, content_type=ctype, size=size, poster_name=poster)
        c.attachments.append(a)
        db.flush()
        out.append(a)
    db.commit()
    return [attachment_out(a) for a in out]


@router.get("/attachments/{att_id}/file")
def get_attachment(att_id: int, download: bool = False, db: Session = Depends(get_db)):
    a = _get(db, Attachment, att_id)
    path = UPLOAD_DIR / a.stored_name
    if not path.exists():
        raise HTTPException(404, "File missing on disk")
    return FileResponse(path, media_type=a.content_type, filename=a.filename,
                        content_disposition_type="attachment" if download else "inline")


@router.get("/attachments/{att_id}/poster")
def get_poster(att_id: int, db: Session = Depends(get_db)):
    a = _get(db, Attachment, att_id)
    if not a.poster_name or not (UPLOAD_DIR / a.poster_name).exists():
        raise HTTPException(404, "No poster")
    return FileResponse(UPLOAD_DIR / a.poster_name, media_type="image/jpeg")


@router.delete("/attachments/{att_id}", status_code=204)
def delete_attachment(att_id: int, db: Session = Depends(get_db)):
    a = _get(db, Attachment, att_id)
    _delete_attachment_files(a)
    db.delete(a)
    db.commit()


def _delete_attachment_files(a: Attachment):
    (UPLOAD_DIR / a.stored_name).unlink(missing_ok=True)
    if a.poster_name:
        (UPLOAD_DIR / a.poster_name).unlink(missing_ok=True)


def _delete_files_for_card(c: Card):
    for a in c.attachments:
        _delete_attachment_files(a)


def _delete_files_for_board(b: Board):
    for l in b.lists:
        for c in l.cards:
            _delete_files_for_card(c)
