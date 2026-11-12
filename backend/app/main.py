import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import boards, days, media, motivation, push, ritual
from .db import BACKGROUND_DIR, Base, VIDEO_DIR, engine

Base.metadata.create_all(engine)


def _migrate():
    """Tiny forward-only migrations for columns added after the first release."""
    from sqlalchemy import inspect, text

    cols = {c["name"] for c in inspect(engine).get_columns("attachments")}
    with engine.begin() as conn:
        if "poster_name" not in cols:
            conn.execute(text("ALTER TABLE attachments ADD COLUMN poster_name VARCHAR(100)"))


_migrate()

@asynccontextmanager
async def lifespan(_app):
    task = None
    if os.environ.get("DISABLE_SCHEDULER") != "1":
        task = asyncio.create_task(push.scheduler_loop())
    yield
    if task:
        task.cancel()


app = FastAPI(title="My Board", lifespan=lifespan)
app.include_router(boards.router)
app.include_router(days.router)
app.include_router(media.router)
app.include_router(motivation.router)
app.include_router(push.router)
app.include_router(ritual.router)


@app.get("/api/health")
def health():
    return {"ok": True}


app.mount("/media/seed/backgrounds", StaticFiles(directory=media.SEED_BG), name="seed-bg")
app.mount("/media/seed/videos", StaticFiles(directory=media.SEED_VIDEO), name="seed-video")
app.mount("/media/user/backgrounds", StaticFiles(directory=BACKGROUND_DIR), name="user-bg")
app.mount("/media/user/videos", StaticFiles(directory=VIDEO_DIR), name="user-video")

# Built React app (in Docker it's copied to ./static). Any non-API path falls back to index.html (SPA routing).
STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).resolve().parent.parent / "static")).resolve()
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        f = STATIC_DIR / path
        if path and f.is_file() and STATIC_DIR in f.resolve().parents:
            return FileResponse(f)
        return FileResponse(STATIC_DIR / "index.html")
