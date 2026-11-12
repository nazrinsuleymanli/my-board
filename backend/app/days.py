"""Calendar (monthly view), special days, per-day mood state, month settings."""
import calendar
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import get_db
from .models import Board, BoardList, Card, DayState, MonthSetting, SpecialDay

router = APIRouter(prefix="/api")

MOODS = {"motivated", "hardday", "cozy", "dreamy"}
SPECIAL_KINDS = {"event", "motivation"}
SPECIAL_COLORS = {"rose", "moss", "teal", "amber", "lilac", "sky"}


def _parse_month(ym: str) -> tuple[int, int]:
    try:
        y, m = (int(x) for x in ym.split("-"))
        assert 1 <= m <= 12
        return y, m
    except Exception:
        raise HTTPException(422, "month must be YYYY-MM")


def special_out(s: SpecialDay) -> dict:
    return {"id": s.id, "day": s.day.isoformat(), "title": s.title, "kind": s.kind, "color": s.color}


def state_out(s: DayState | None, day: date) -> dict:
    return {
        "day": day.isoformat(),
        "mood": s.mood if s else None,
        "mood_asked": bool(s and s.mood_asked),
        "video_shown": bool(s and s.video_shown),
    }


def _specials_in_month(db: Session, y: int, m: int):
    first, last = date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
    return db.scalars(
        select(SpecialDay).where(SpecialDay.day >= first, SpecialDay.day <= last).order_by(SpecialDay.day, SpecialDay.id)
    ).all()


# ---------- calendar ----------

@router.get("/calendar/{ym}")
def month_view(ym: str, db: Session = Depends(get_db)):
    y, m = _parse_month(ym)
    first, last = date(y, m, 1), date(y, m, calendar.monthrange(y, m)[1])
    rows = db.execute(
        select(Board.day, BoardList.is_done, func.count(Card.id))
        .join(BoardList, BoardList.board_id == Board.id)
        .join(Card, Card.list_id == BoardList.id)
        .where(Board.kind == "daily", Board.day >= first, Board.day <= last)
        .group_by(Board.day, BoardList.is_done)
    ).all()
    days: dict[str, dict] = {}
    for d, is_done, n in rows:
        e = days.setdefault(d.isoformat(), {"total": 0, "done": 0, "mood": None})
        e["total"] += n
        if is_done:
            e["done"] += n
    for s in db.scalars(select(DayState).where(DayState.day >= first, DayState.day <= last)):
        if s.mood:
            days.setdefault(s.day.isoformat(), {"total": 0, "done": 0, "mood": None})["mood"] = s.mood
    from .ritual import _ritual_days

    for d in _ritual_days(db, first, last):
        days.setdefault(d.isoformat(), {"total": 0, "done": 0, "mood": None})["ritual"] = True
    for e in days.values():
        e.setdefault("ritual", False)
    setting = db.get(MonthSetting, ym)
    return {
        "month": ym,
        "days": days,
        "special_days": [special_out(s) for s in _specials_in_month(db, y, m)],
        "motivation_month": bool(setting and setting.motivation_month),
    }


# ---------- special days ----------

class SpecialIn(BaseModel):
    day: date
    title: str = Field(min_length=1, max_length=200)
    kind: str = "event"
    color: str = "rose"


class SpecialPatch(BaseModel):
    day: date | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    kind: str | None = None
    color: str | None = None


def _validate_special(kind, color):
    if kind is not None and kind not in SPECIAL_KINDS:
        raise HTTPException(422, f"kind must be one of {sorted(SPECIAL_KINDS)}")
    if color is not None and color not in SPECIAL_COLORS:
        raise HTTPException(422, f"color must be one of {sorted(SPECIAL_COLORS)}")


@router.get("/special-days")
def list_specials(month: str, db: Session = Depends(get_db)):
    y, m = _parse_month(month)
    return [special_out(s) for s in _specials_in_month(db, y, m)]


@router.post("/special-days", status_code=201)
def add_special(body: SpecialIn, db: Session = Depends(get_db)):
    _validate_special(body.kind, body.color)
    s = SpecialDay(day=body.day, title=body.title.strip(), kind=body.kind, color=body.color)
    db.add(s)
    db.commit()
    return special_out(s)


@router.patch("/special-days/{sid}")
def patch_special(sid: int, body: SpecialPatch, db: Session = Depends(get_db)):
    s = db.get(SpecialDay, sid) or _404()
    data = body.model_dump(exclude_unset=True)
    _validate_special(data.get("kind"), data.get("color"))
    for k, v in data.items():
        setattr(s, k, v.strip() if k == "title" else v)
    db.commit()
    return special_out(s)


@router.delete("/special-days/{sid}", status_code=204)
def delete_special(sid: int, db: Session = Depends(get_db)):
    s = db.get(SpecialDay, sid) or _404()
    db.delete(s)
    db.commit()


def _404():
    raise HTTPException(404, "Not found")


# ---------- day state (mood) ----------

class StateIn(BaseModel):
    mood: str | None = None
    mood_asked: bool | None = None
    video_shown: bool | None = None


@router.get("/days/{day}/state")
def get_state(day: date, db: Session = Depends(get_db)):
    return state_out(db.get(DayState, day), day)


@router.put("/days/{day}/state")
def put_state(day: date, body: StateIn, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if data.get("mood") is not None and data["mood"] not in MOODS:
        raise HTTPException(422, f"mood must be one of {sorted(MOODS)} or null")
    s = db.get(DayState, day)
    if not s:
        s = DayState(day=day)
        db.add(s)
    for k, v in data.items():
        setattr(s, k, v)
    db.commit()
    return state_out(s, day)


# ---------- month settings ----------

class MonthIn(BaseModel):
    motivation_month: bool


@router.put("/months/{ym}")
def put_month(ym: str, body: MonthIn, db: Session = Depends(get_db)):
    _parse_month(ym)
    s = db.get(MonthSetting, ym) or MonthSetting(month=ym)
    s.motivation_month = body.motivation_month
    db.add(s)
    db.commit()
    return {"month": ym, "motivation_month": s.motivation_month}


# ---------- today: everything the app needs on open ----------

@router.get("/today")
def today_info(day: date, db: Session = Depends(get_db)):
    """`day` is the client's local date (the server may run in another timezone)."""
    state = db.get(DayState, day)
    ym = f"{day.year:04d}-{day.month:02d}"
    month_specials = _specials_in_month(db, day.year, day.month)
    todays = [s for s in month_specials if s.day == day]
    setting = db.get(MonthSetting, ym)
    motivation_day = any(s.kind == "motivation" for s in todays) or bool(setting and setting.motivation_month)
    mood = state.mood if state else None
    return {
        "state": state_out(state, day),
        "special_days_today": [special_out(s) for s in todays],
        "upcoming": [special_out(s) for s in month_specials if s.day > day][:3],
        "motivation_day": motivation_day,
        "should_ask_mood": not (state and state.mood_asked),
        "should_show_video": (mood == "motivated" or motivation_day) and not (state and state.video_shown),
        # first week of a month with nothing planned yet -> nudge to fill in special days
        "month_needs_specials": day.day <= 7 and not month_specials,
    }
