"""Theme background images (season + mood) and local motivation videos."""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from .db import BACKGROUND_DIR, VIDEO_DIR
from .video import normalize_video

router = APIRouter(prefix="/api")

SEED_DIR = Path(__file__).resolve().parent / "seed_media"
SEED_BG = SEED_DIR / "backgrounds"
SEED_VIDEO = SEED_DIR / "videos"
THEME_KEYS = ["winter", "spring", "summer", "autumn", "motivated", "hardday", "cozy", "dreamy"]
for _d in (SEED_BG, SEED_VIDEO):  # may be empty / untracked in git (personal videos stay out of the repo)
    _d.mkdir(parents=True, exist_ok=True)
IMG_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO_EXT = {".mp4", ".webm", ".mov", ".m4v"}


def _key_of(name: str) -> str | None:
    m = re.match(r"^([a-z]+)_", name)
    return m.group(1) if m and m.group(1) in THEME_KEYS else None


def list_backgrounds() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {k: [] for k in THEME_KEYS}
    for folder, prefix, removable in ((SEED_BG, "/media/seed/backgrounds", False),
                                      (BACKGROUND_DIR, "/media/user/backgrounds", True)):
        for p in sorted(folder.glob("*")):
            k = _key_of(p.name)
            if k and p.suffix.lower() in IMG_EXT:
                out[k].append({"name": p.name, "url": f"{prefix}/{p.name}", "removable": removable})
    return out


def list_local_videos() -> list[dict]:
    vids = []
    for folder, prefix in ((SEED_VIDEO, "/media/seed/videos"), (VIDEO_DIR, "/media/user/videos")):
        for p in sorted(folder.glob("*")):
            if p.suffix.lower() in VIDEO_EXT:
                vids.append({"id": f"local:{p.name}", "url": f"{prefix}/{p.name}", "title": "Your study vlog"})
    return vids


@router.get("/backgrounds")
def get_backgrounds():
    return list_backgrounds()


@router.post("/backgrounds/{key}", status_code=201)
async def upload_background(key: str, file: UploadFile = File(...)):
    if key not in THEME_KEYS:
        raise HTTPException(404, "Unknown theme")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in IMG_EXT:
        raise HTTPException(422, "Upload an image (jpg, png, webp, gif, avif)")
    name = f"{key}_{uuid.uuid4().hex[:8]}{ext}"
    (BACKGROUND_DIR / name).write_bytes(await file.read())
    return list_backgrounds()


@router.delete("/backgrounds/{name}", status_code=204)
def delete_background(name: str):
    p = BACKGROUND_DIR / Path(name).name
    if not p.exists():
        raise HTTPException(404, "Only your uploaded backgrounds can be removed")
    p.unlink()


@router.get("/videos")
def get_videos():
    return list_local_videos()


@router.post("/videos", status_code=201)
async def upload_video(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in VIDEO_EXT:
        raise HTTPException(422, "Upload a video (mp4, webm, mov)")
    name = f"vlog_{uuid.uuid4().hex[:8]}{ext}"
    with open(VIDEO_DIR / name, "wb") as fh:
        while chunk := await file.read(1024 * 1024):
            fh.write(chunk)
    await run_in_threadpool(normalize_video, VIDEO_DIR / name)  # iPhone .mov -> mp4 that plays everywhere
    return list_local_videos()
