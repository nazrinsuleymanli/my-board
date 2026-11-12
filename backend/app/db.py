import os
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent.parent / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
BACKGROUND_DIR = DATA_DIR / "backgrounds"
VIDEO_DIR = DATA_DIR / "videos"
for d in (DATA_DIR, UPLOAD_DIR, BACKGROUND_DIR, VIDEO_DIR):
    d.mkdir(parents=True, exist_ok=True)

DB_URL = os.environ.get("DB_URL", f"sqlite:///{DATA_DIR / 'app.db'}")

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    if DB_URL.startswith("sqlite"):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
