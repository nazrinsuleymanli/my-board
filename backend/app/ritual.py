"""Ritual: 🌅 'Halaldır sənə' in the morning, 🌙 'Şükür' in the evening, streak, Uğurlar dəftəri, Siri quick-add.

Idea: feelings of "not enough" don't listen to generic praise — they listen to evidence.
So the morning shows real evidence from her own data (what she finished, moments, what she was proud of).
"""
import json
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .boards import get_or_create_daily
from .db import get_db
from .models import Affirmation, AppSetting, Board, BoardList, Card, Reflection

router = APIRouter(prefix="/api")

DEFAULT_AFFIRMATIONS = [
    "Mən çətin şeyləri öyrənə bilirəm — artıq dəfələrlə öyrənmişəm.",
    "Yeni bir ölkədə öz həyatımı sıfırdan qurmuşam.",
    "Kiçik addımlar da irəliləyişdir, mən hər gün addım atıram.",
    "Mən olduğum kimi yetərliyəm.",
    "Dünənki özümdən bir az daha güclüyəm.",
]
DEFAULT_DUA = (
    "Allahım, bu günə, sağlamlığıma, ailəmə və mənə verdiyin hər nemətə görə şükürlər olsun. "
    "Bacardıqlarıma görə şükür edirəm; bacarmadıqlarımda isə mənə səbr və güc ver. "
    "Qəlbimə rahatlıq, sabahıma xeyir və bərəkət ver. Amin. 🤲"
)


# ---------- helpers ----------

def _setting(db: Session, key: str, default: str) -> str:
    s = db.get(AppSetting, key)
    return s.value if s else default


def _ensure_affirmations(db: Session):
    if not db.get(AppSetting, "affirmations_seeded"):
        for t in DEFAULT_AFFIRMATIONS:
            db.add(Affirmation(text=t))
        db.add(AppSetting(key="affirmations_seeded", value="1"))
        db.commit()


def _day_stats(db: Session, first: date, last: date) -> dict[date, tuple[int, int]]:
    rows = db.execute(
        select(Board.day, BoardList.is_done, func.count(Card.id))
        .join(BoardList, BoardList.board_id == Board.id)
        .join(Card, Card.list_id == BoardList.id)
        .where(Board.kind == "daily", Board.day >= first, Board.day <= last)
        .group_by(Board.day, BoardList.is_done)
    ).all()
    out: dict[date, list[int]] = {}
    for d, is_done, n in rows:
        e = out.setdefault(d, [0, 0])
        e[0] += n
        if is_done:
            e[1] += n
    return {d: (t, dn) for d, (t, dn) in out.items()}


def _ritual_days(db: Session, first: date, last: date) -> set[date]:
    return {
        r.day
        for r in db.scalars(select(Reflection).where(Reflection.day >= first, Reflection.day <= last))
        if r.proud.strip() or any(g.strip() for g in json.loads(r.gratitude or "[]"))
    }


def counted_days(db: Session, first: date, last: date) -> set[date]:
    """A day counts if at least half of its cards are done, OR the evening ritual was done
    (so a heavy day where she still wrote her şükür never breaks the streak)."""
    stats = _day_stats(db, first, last)
    good = {d for d, (t, dn) in stats.items() if t > 0 and dn * 2 >= t}
    return good | _ritual_days(db, first, last)


def streak(db: Session, day: date) -> dict:
    first = day - timedelta(days=400)
    days = counted_days(db, first, day)
    today_counted = day in days
    cur, d = 0, (day if today_counted else day - timedelta(days=1))
    while d in days:
        cur += 1
        d -= timedelta(days=1)
    best, run, d = 0, 0, first
    while d <= day:
        run = run + 1 if d in days else 0
        best = max(best, run)
        d += timedelta(days=1)
    return {"current": cur, "today_counted": today_counted, "best": max(best, cur)}


def _done_cards(db: Session, day: date) -> list[Card]:
    return list(
        db.scalars(
            select(Card)
            .join(BoardList, Card.list_id == BoardList.id)
            .join(Board, BoardList.board_id == Board.id)
            .where(Board.kind == "daily", Board.day == day, BoardList.is_done.is_(True))
            .order_by(Card.position)
        )
    )


def _moments(db: Session, day: date) -> list[dict]:
    cards = db.scalars(
        select(Card).join(BoardList, Card.list_id == BoardList.id).join(Board, BoardList.board_id == Board.id)
        .where(Board.kind == "daily", Board.day == day)
    ).all()
    out = []
    for c in cards:
        for a in c.attachments:
            if a.content_type.startswith("image/"):
                out.append({"card": c.title, "url": f"/api/attachments/{a.id}/file"})
            elif a.poster_name:
                out.append({"card": c.title, "url": f"/api/attachments/{a.id}/poster", "video": True})
    return out[:6]


def reflection_out(r: Reflection | None, day: date) -> dict:
    g = json.loads(r.gratitude) if r else []
    return {
        "day": day.isoformat(),
        "gratitude": (g + ["", "", ""])[:3],
        "proud": r.proud if r else "",
        "tomorrow_task": r.tomorrow_task if r else "",
        "done": bool(r and (r.proud.strip() or any(x.strip() for x in g))),
    }


def halal_line(db: Session, day: date) -> str:
    """One short line for the morning notification."""
    y = day - timedelta(days=1)
    n = len(_done_cards(db, y))
    s = streak(db, day)["current"]
    parts = ["Halaldır sənə 💛"]
    if n:
        parts.append(f"Dünən {n} iş bitirdin")
    elif (r := db.get(Reflection, y)) and r.proud.strip():
        parts.append(f"Dünən: {r.proud.strip()[:60]}")
    if s >= 2:
        parts.append(f"🔥 {s} gün ardıcıl")
    return " · ".join(parts)


# ---------- routes ----------

@router.get("/halal")
def halal(day: date, db: Session = Depends(get_db)):
    """🌅 Morning evidence: yesterday's wins + an affirmation in her own words."""
    _ensure_affirmations(db)
    y = day - timedelta(days=1)
    affs = db.scalars(select(Affirmation).order_by(Affirmation.id)).all()
    yr = db.get(Reflection, y)
    return {
        "yesterday": y.isoformat(),
        "done": [c.title for c in _done_cards(db, y)],
        "moments": _moments(db, y),
        "proud": yr.proud if yr else "",
        "gratitude": [g for g in (json.loads(yr.gratitude) if yr else []) if g.strip()],
        "affirmation": affs[day.toordinal() % len(affs)].text if affs else None,
        "streak": streak(db, day),
        "line": halal_line(db, day),
    }


@router.get("/streak")
def get_streak(day: date, db: Session = Depends(get_db)):
    return streak(db, day)


class ReflectionIn(BaseModel):
    gratitude: list[str] = Field(default_factory=list, max_length=3)
    proud: str = Field("", max_length=1000)
    tomorrow_task: str = Field("", max_length=500)


@router.get("/reflections/{day}")
def get_reflection(day: date, db: Session = Depends(get_db)):
    return reflection_out(db.get(Reflection, day), day)


@router.put("/reflections/{day}")
def put_reflection(day: date, body: ReflectionIn, db: Session = Depends(get_db)):
    r = db.get(Reflection, day) or Reflection(day=day)
    r.gratitude = json.dumps([g.strip() for g in body.gratitude][:3], ensure_ascii=False)
    r.proud = body.proud.strip()
    task = body.tomorrow_task.strip()
    # "tomorrow's one main task" lands at the top of tomorrow's To Do (and stays in sync if edited)
    card = db.get(Card, r.tomorrow_card_id) if r.tomorrow_card_id else None
    if task and card:
        card.title = task
    elif task:
        tb = get_or_create_daily(db, day + timedelta(days=1), False)
        first = next(l for l in tb.lists if not l.is_done)
        for c in first.cards:
            c.position += 1
        card = Card(title=task, position=0, label="amber", list_id=first.id)
        db.add(card)
        db.flush()
        r.tomorrow_card_id = card.id
    elif card:
        db.delete(card)
        r.tomorrow_card_id = None
    r.tomorrow_task = task
    db.add(r)
    db.commit()
    return reflection_out(r, day)


@router.get("/wins")
def wins(limit: int = 60, db: Session = Depends(get_db)):
    """📔 Uğurlar dəftəri: everything good she wrote, newest first, with that day's finished tasks."""
    rows = db.scalars(select(Reflection).order_by(Reflection.day.desc()).limit(limit)).all()
    out = []
    for r in rows:
        ro = reflection_out(r, r.day)
        if not ro["done"]:
            continue
        out.append({**ro, "gratitude": [g for g in ro["gratitude"] if g], "finished": [c.title for c in _done_cards(db, r.day)]})
    return out


@router.get("/affirmations")
def list_affirmations(db: Session = Depends(get_db)):
    _ensure_affirmations(db)
    return [{"id": a.id, "text": a.text} for a in db.scalars(select(Affirmation).order_by(Affirmation.id))]


class AffIn(BaseModel):
    text: str = Field(min_length=1, max_length=300)


@router.post("/affirmations", status_code=201)
def add_affirmation(body: AffIn, db: Session = Depends(get_db)):
    _ensure_affirmations(db)
    db.add(Affirmation(text=body.text.strip()))
    db.commit()
    return list_affirmations(db)


@router.delete("/affirmations/{aid}", status_code=204)
def delete_affirmation(aid: int, db: Session = Depends(get_db)):
    a = db.get(Affirmation, aid)
    if a:
        db.delete(a)
        db.commit()


@router.get("/dua")
def get_dua(db: Session = Depends(get_db)):
    return {"text": _setting(db, "dua_text", DEFAULT_DUA), "is_default": not db.get(AppSetting, "dua_text")}


class DuaIn(BaseModel):
    text: str = Field(min_length=1, max_length=3000)


@router.put("/dua")
def put_dua(body: DuaIn, db: Session = Depends(get_db)):
    s = db.get(AppSetting, "dua_text") or AppSetting(key="dua_text", value="")
    s.value = body.text.strip()
    db.add(s)
    db.commit()
    return get_dua(db)


# ---------- Siri ("Hey Siri, task əlavə et") ----------

def server_today(db: Session) -> date:
    return datetime.now(ZoneInfo(_setting(db, "timezone", "Europe/Prague"))).date()


class QuickIn(BaseModel):
    text: str = Field(min_length=1, max_length=500)


@router.post("/quick/task", response_class=PlainTextResponse)
def quick_task(body: QuickIn, db: Session = Depends(get_db)):
    """Called by the iPhone Shortcut. Returns plain text that Siri reads out loud."""
    text = body.text.strip().rstrip(".")
    if not text:
        raise HTTPException(422, "Empty task")
    b = get_or_create_daily(db, server_today(db), True)
    first = next(l for l in b.lists if not l.is_done)
    first.cards.append(Card(title=text[0].upper() + text[1:], position=len(first.cards)))
    db.commit()
    return f"Əlavə etdim: {text}"
