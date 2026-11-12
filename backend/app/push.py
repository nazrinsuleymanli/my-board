"""Morning message: Web Push to the phone (home-screen app), every day at a chosen time.

Tap the notification -> /morning (quote + ♓ line + today's motivation video).
iPhone rule: works only for the app added to the Home Screen, opened over HTTPS (see README).
"""
import asyncio
import base64
import json
import os
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import serialization
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import morning_messages as mm
from .db import DATA_DIR, SessionLocal, get_db
from .models import AppSetting, PushSub

router = APIRouter(prefix="/api")

VAPID_FILE = DATA_DIR / "vapid_private.pem"
VAPID_SUB = os.environ.get("VAPID_SUBJECT", "mailto:myboard@example.com")
DEFAULTS = {
    "morning_enabled": "1",
    "morning_time": "08:00",
    "evening_enabled": "1",
    "evening_time": "21:30",
    "timezone": os.environ.get("TZ_NAME", "Europe/Prague"),
    "last_sent": "",
    "last_sent_evening": "",
}
SEND_WINDOW = timedelta(hours=3)  # if the server was off at 08:00, still send until 11:00 — but not in the afternoon


# ---------- settings ----------

def get_setting(db: Session, key: str) -> str:
    s = db.get(AppSetting, key)
    return s.value if s else DEFAULTS[key]


def set_setting(db: Session, key: str, value: str):
    s = db.get(AppSetting, key) or AppSetting(key=key, value=value)
    s.value = value
    db.add(s)


# ---------- VAPID ----------

def _vapid():
    from py_vapid import Vapid01

    if VAPID_FILE.exists():
        return Vapid01.from_file(str(VAPID_FILE))
    v = Vapid01()
    v.generate_keys()
    v.save_key(str(VAPID_FILE))
    return v


def public_key() -> str:
    raw = _vapid().public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


# ---------- content ----------

def morning_content(day: date, hour: int = 8) -> dict:
    return {"day": day.isoformat(), "greeting": mm.greeting(hour), **mm.for_day(day.toordinal())}


def webpush_send(sub: PushSub, payload: dict):
    """Single place that talks to Apple/Google push services (tests monkeypatch this)."""
    from pywebpush import webpush

    _vapid()  # make sure the key exists
    webpush(
        subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
        data=json.dumps(payload),
        vapid_private_key=str(VAPID_FILE),
        vapid_claims={"sub": VAPID_SUB},
        ttl=4 * 3600,
    )


def morning_payload(db: Session, day: date) -> dict:
    from .ritual import halal_line

    c = morning_content(day)
    return {
        "title": f"{c['greeting']} ☀️",
        "body": f"{halal_line(db, day)}\n{c['quote']}\n{c['pisces']}",
        "url": "/morning",
        "tag": f"morning-{day.isoformat()}",
    }


def evening_payload(day: date) -> dict:
    return {
        "title": "Axşamın xeyir, Nazrin 🌙",
        "body": "Bu gün nəyə şükür edirsən? 3 şey yaz, özünü bir dəfə təriflə — sonra dincəl.",
        "url": "/ritual",
        "tag": f"evening-{day.isoformat()}",
    }


def send_morning(db: Session, day: date) -> dict:
    return send_all(db, morning_payload(db, day))


def send_all(db: Session, payload: dict) -> dict:
    sent, removed, failed = 0, 0, 0
    for sub in db.scalars(select(PushSub)).all():
        try:
            webpush_send(sub, payload)
            sent += 1
        except Exception as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if status in (404, 410):  # phone unsubscribed / app removed
                db.delete(sub)
                removed += 1
            else:
                failed += 1
                print(f"[push] failed: {e}")
    db.commit()
    return {"sent": sent, "removed": removed, "failed": failed}


def is_due(now_local: datetime, morning_time: str, last_sent: str, enabled: bool) -> bool:
    if not enabled or last_sent == now_local.date().isoformat():
        return False
    h, m = (int(x) for x in morning_time.split(":"))
    at = datetime.combine(now_local.date(), time(h, m), tzinfo=now_local.tzinfo)
    return at <= now_local < at + SEND_WINDOW


JOBS = [  # (enabled key, time key, last-sent key, payload builder)
    ("morning_enabled", "morning_time", "last_sent", lambda db, d: morning_payload(db, d)),
    ("evening_enabled", "evening_time", "last_sent_evening", lambda db, d: evening_payload(d)),
]


def tick(now_utc: datetime | None = None) -> list[str]:
    """Send whatever is due right now. Returns which jobs fired (for tests)."""
    fired = []
    with SessionLocal() as db:
        tz = ZoneInfo(get_setting(db, "timezone"))
        now = (now_utc or datetime.now(ZoneInfo("UTC"))).astimezone(tz)
        for enabled_k, time_k, last_k, build in JOBS:
            if not is_due(now, get_setting(db, time_k), get_setting(db, last_k), get_setting(db, enabled_k) == "1"):
                continue
            set_setting(db, last_k, now.date().isoformat())
            db.commit()
            send_all(db, build(db, now.date()))
            fired.append(time_k.split("_")[0])
    return fired


async def scheduler_loop():
    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception as e:  # never let the loop die
            print(f"[push] scheduler error: {e}")
        await asyncio.sleep(30)


# ---------- routes ----------

class SubIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)
    keys: dict[str, str]


class MorningSettingsIn(BaseModel):
    enabled: bool
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    evening_enabled: bool | None = None
    evening_time: str | None = Field(None, pattern=r"^\d{2}:\d{2}$")


@router.get("/morning")
def morning(day: date, hour: int = 8):
    return morning_content(day, hour)


@router.get("/push/key")
def push_key():
    return {"public_key": public_key()}


@router.post("/push/subscribe", status_code=201)
def subscribe(body: SubIn, db: Session = Depends(get_db)):
    if "p256dh" not in body.keys or "auth" not in body.keys:
        raise HTTPException(422, "keys.p256dh and keys.auth are required")
    sub = db.scalar(select(PushSub).where(PushSub.endpoint == body.endpoint)) or PushSub(endpoint=body.endpoint)
    sub.p256dh, sub.auth = body.keys["p256dh"], body.keys["auth"]
    db.add(sub)
    db.commit()
    return {"ok": True, "devices": len(db.scalars(select(PushSub)).all())}


@router.post("/push/unsubscribe")
def unsubscribe(body: SubIn, db: Session = Depends(get_db)):
    sub = db.scalar(select(PushSub).where(PushSub.endpoint == body.endpoint))
    if sub:
        db.delete(sub)
        db.commit()
    return {"ok": True}


@router.post("/push/test")
def push_test(day: date, kind: str = "morning", db: Session = Depends(get_db)):
    if not db.scalars(select(PushSub)).first():
        raise HTTPException(400, "No device has notifications turned on yet")
    return send_all(db, evening_payload(day) if kind == "evening" else morning_payload(db, day))


@router.get("/settings/morning")
def get_morning_settings(db: Session = Depends(get_db)):
    return {
        "enabled": get_setting(db, "morning_enabled") == "1",
        "time": get_setting(db, "morning_time"),
        "evening_enabled": get_setting(db, "evening_enabled") == "1",
        "evening_time": get_setting(db, "evening_time"),
        "timezone": get_setting(db, "timezone"),
        "devices": len(db.scalars(select(PushSub)).all()),
    }


@router.put("/settings/morning")
def put_morning_settings(body: MorningSettingsIn, db: Session = Depends(get_db)):
    for t in (body.time, body.evening_time):
        if t is not None:
            h, m = (int(x) for x in t.split(":"))
            if h > 23 or m > 59:
                raise HTTPException(422, "Invalid time")
    set_setting(db, "morning_enabled", "1" if body.enabled else "0")
    set_setting(db, "morning_time", body.time)
    if body.evening_enabled is not None:
        set_setting(db, "evening_enabled", "1" if body.evening_enabled else "0")
    if body.evening_time is not None:
        set_setting(db, "evening_time", body.evening_time)
    db.commit()
    return get_morning_settings(db)
