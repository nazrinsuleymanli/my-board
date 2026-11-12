"""A tiny 'YouTube algorithm' for morning motivation videos.

How it works (content-based, no AI):
  1. Seed videos (the ones you liked) -> their channels + title/tag keywords get starting weights.
  2. Each morning we search YouTube Shorts with a keyword picked by weight, and show one video
     you have never seen, scored by keyword weight x channel weight.
  3. 👍 / 👎 multiplies the weights of that video's keyword and channel up / down.
  4. Sometimes (and always when there's no API key / no network) one of your own study vlogs plays.
"""
import os
import random
import re
from collections import Counter

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .db import get_db
from .media import list_local_videos
from .models import utcnow, CandidateVideo, SeedVideo, SeenVideo, Weight

router = APIRouter(prefix="/api/motivation")

DEFAULT_SEEDS = ["AzI3lD4m0Ms", "_nadnfsta_8", "GtdwU4Myd-U"]
BASE_KEYWORDS = [
    "study motivation", "discipline motivation", "do it tired motivation", "study with me",
    "student motivation", "consistency over motivation", "exam motivation", "productive study vlog",
]
LOCAL_SHARE = 0.25  # how often your own vlog shows up even when YouTube works
LIKE_UP, DISLIKE_DOWN, MIN_W, MAX_W = 1.35, 0.6, 0.1, 6.0
STOPWORDS = set("""a an the and or of to in on for with is are be you your my me i it this that do it's
    how why what when shorts short video videos youtube vs not no at by from as so day days""".split())


def api_key() -> str:
    return os.environ.get("YOUTUBE_API_KEY", "").strip()


def yt_get(path: str, params: dict) -> dict:
    """Single place that talks to YouTube (tests monkeypatch this)."""
    r = httpx.get(f"https://www.googleapis.com/youtube/v3/{path}", params={**params, "key": api_key()}, timeout=10)
    r.raise_for_status()
    return r.json()


def video_id_from(text: str) -> str | None:
    text = text.strip()
    m = re.search(r"(?:shorts/|v=|youtu\.be/|embed/)([A-Za-z0-9_-]{11})", text)
    if m:
        return m.group(1)
    return text if re.fullmatch(r"[A-Za-z0-9_-]{11}", text) else None


# ---------- weights ----------

def _w(db: Session, kind: str, key: str) -> Weight:
    w = db.scalar(select(Weight).where(Weight.kind == kind, Weight.key == key))
    if not w:
        w = Weight(kind=kind, key=key, value=1.0)
        db.add(w)
        db.flush()
    return w


def _weight_value(db: Session, kind: str, key: str | None) -> float:
    if not key:
        return 1.0
    w = db.scalar(select(Weight).where(Weight.kind == kind, Weight.key == key))
    return w.value if w else 1.0


def seeds(db: Session) -> list[str]:
    rows = db.scalars(select(SeedVideo.video_id)).all()
    if not rows and not db.scalar(select(Weight).where(Weight.kind == "meta", Weight.key == "seeds_init")):
        for vid in DEFAULT_SEEDS:
            db.add(SeedVideo(video_id=vid))
        db.add(Weight(kind="meta", key="seeds_init", value=1))
        db.commit()
        rows = list(DEFAULT_SEEDS)
    return list(rows)


def learn_from_seeds(db: Session):
    """Once per seed set: pull channel + keywords from seed videos (needs API key)."""
    if db.scalar(select(Weight).where(Weight.kind == "meta", Weight.key == "seeds_learned")):
        return
    for kw in BASE_KEYWORDS:
        _w(db, "keyword", kw)
    ids = seeds(db)
    if ids:
        data = yt_get("videos", {"part": "snippet", "id": ",".join(ids)})
        words = Counter()
        for item in data.get("items", []):
            sn = item.get("snippet", {})
            ch = _w(db, "channel", sn.get("channelId", ""))
            ch.value = min(MAX_W, ch.value * 1.5)
            for tag in sn.get("tags", [])[:15]:
                tag = tag.lower().strip()
                if 3 <= len(tag) <= 40 and not tag.startswith("#"):
                    words[tag] += 1
            for wd in re.findall(r"[a-zA-Z]{4,}", sn.get("title", "").lower()):
                if wd not in STOPWORDS:
                    words[wd + " motivation"] += 1
        for kw, _ in words.most_common(8):
            _w(db, "keyword", kw)
    db.add(Weight(kind="meta", key="seeds_learned", value=1))
    db.commit()


def refill_candidates(db: Session):
    kws = db.scalars(select(Weight).where(Weight.kind == "keyword")).all()
    if not kws:
        return
    kw = random.choices(kws, weights=[k.value for k in kws])[0].key
    data = yt_get("search", {
        "part": "snippet", "type": "video", "videoDuration": "short", "videoEmbeddable": "true",
        "safeSearch": "moderate", "relevanceLanguage": "en", "maxResults": 25, "q": kw,
    })
    seen = set(db.scalars(select(SeenVideo.video_id)).all())
    have = set(db.scalars(select(CandidateVideo.video_id)).all())
    for item in data.get("items", []):
        vid = item.get("id", {}).get("videoId")
        if not vid or vid in seen or vid in have:
            continue
        sn = item.get("snippet", {})
        db.add(CandidateVideo(video_id=vid, channel_id=sn.get("channelId", ""), title=sn.get("title", "")[:300], keyword=kw))
        have.add(vid)
    db.commit()


def _youtube_out(vid: str, title: str) -> dict:
    return {
        "source": "youtube",
        "id": vid,
        "title": title,
        "embed_url": f"https://www.youtube-nocookie.com/embed/{vid}?autoplay=1&playsinline=1&rel=0&modestbranding=1",
        "watch_url": f"https://www.youtube.com/shorts/{vid}",
    }


def _pick_local(db: Session) -> dict | None:
    vids = list_local_videos()
    if not vids:
        return None
    last_seen = {s.video_id: s.seen_at for s in db.scalars(select(SeenVideo).where(SeenVideo.source == "local"))}
    vids.sort(key=lambda v: (v["id"] in last_seen, last_seen.get(v["id"])))  # never-seen first, then oldest
    v = vids[0]
    _mark_seen(db, v["id"], "local", None, v["title"], None)
    return {"source": "local", "id": v["id"], "title": v["title"], "video_url": v["url"]}


def _mark_seen(db: Session, vid, source, channel, title, keyword):
    s = db.get(SeenVideo, vid)
    if s:
        s.seen_at = utcnow()
    else:
        db.add(SeenVideo(video_id=vid, source=source, channel_id=channel, title=title or "", keyword=keyword))
    db.commit()


def pick_next(db: Session, rng: random.Random | None = None) -> dict:
    rng = rng or random
    seed_ids = seeds(db)
    seen = set(db.scalars(select(SeenVideo.video_id)).all())

    # 1) your seed videos first, in order, until watched
    for vid in seed_ids:
        if vid not in seen:
            _mark_seen(db, vid, "youtube", None, "", None)
            return _youtube_out(vid, "From your favourites")

    # 2) sometimes your own vlog
    if rng.random() < LOCAL_SHARE or not api_key():
        local = _pick_local(db)
        if local:
            return local

    # 3) recommendation from YouTube
    if api_key():
        try:
            learn_from_seeds(db)
            cands = db.scalars(select(CandidateVideo)).all()
            if len(cands) < 3:
                refill_candidates(db)
                cands = db.scalars(select(CandidateVideo)).all()
            if cands:
                scored = sorted(
                    cands,
                    key=lambda c: _weight_value(db, "keyword", c.keyword) * _weight_value(db, "channel", c.channel_id)
                    * (0.85 + rng.random() * 0.3),  # small jitter so it is not always the same order
                    reverse=True,
                )
                c = scored[0]
                db.delete(c)
                _mark_seen(db, c.video_id, "youtube", c.channel_id, c.title, c.keyword)
                return _youtube_out(c.video_id, c.title)
        except Exception as e:  # network / quota problems must never break the morning
            print(f"[motivation] YouTube unavailable: {e}")

    # 4) fallbacks: own vlog, else rewatch a liked / seed video
    local = _pick_local(db)
    if local:
        return local
    liked = db.scalars(select(SeenVideo).where(SeenVideo.source == "youtube", SeenVideo.liked.is_not(False))).all()
    pool = [s.video_id for s in liked] or seed_ids
    if not pool:
        raise HTTPException(404, "No motivation videos yet — add a YouTube link or upload a vlog in Settings")
    vid = rng.choice(pool)
    return _youtube_out(vid, "Again, because it worked")


# ---------- routes ----------

@router.get("/next")
def next_video(db: Session = Depends(get_db)):
    return pick_next(db)


class FeedbackIn(BaseModel):
    video_id: str
    liked: bool


@router.post("/feedback")
def feedback(body: FeedbackIn, db: Session = Depends(get_db)):
    s = db.get(SeenVideo, body.video_id)
    if not s:
        raise HTTPException(404, "Unknown video")
    s.liked = body.liked
    factor = LIKE_UP if body.liked else DISLIKE_DOWN
    for kind, key in (("keyword", s.keyword), ("channel", s.channel_id)):
        if key:
            w = _w(db, kind, key)
            w.value = max(MIN_W, min(MAX_W, w.value * factor))
    db.commit()
    return {"ok": True}


class SeedIn(BaseModel):
    url: str


@router.get("/seeds")
def get_seeds(db: Session = Depends(get_db)):
    return [{"id": v, "watch_url": f"https://www.youtube.com/shorts/{v}"} for v in seeds(db)]


@router.post("/seeds", status_code=201)
def add_seed(body: SeedIn, db: Session = Depends(get_db)):
    vid = video_id_from(body.url)
    if not vid:
        raise HTTPException(422, "That doesn't look like a YouTube link")
    seeds(db)
    if not db.get(SeedVideo, vid):
        db.add(SeedVideo(video_id=vid))
    db.execute(delete(Weight).where(Weight.kind == "meta", Weight.key == "seeds_learned"))  # re-learn
    db.commit()
    return get_seeds(db)


@router.delete("/seeds/{vid}", status_code=204)
def remove_seed(vid: str, db: Session = Depends(get_db)):
    seeds(db)
    s = db.get(SeedVideo, vid)
    if s:
        db.delete(s)
        db.commit()


@router.get("/status")
def status():
    return {"youtube_enabled": bool(api_key()), "local_videos": len(list_local_videos())}
