from datetime import UTC, date, datetime


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Board(Base):
    __tablename__ = "boards"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="custom")  # "daily" | "custom"
    day: Mapped[date | None] = mapped_column(Date, unique=True, nullable=True)  # only for daily boards
    carry_done: Mapped[bool] = mapped_column(Boolean, default=False)  # unfinished cards already pulled in
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    lists: Mapped[list["BoardList"]] = relationship(
        back_populates="board", cascade="all, delete-orphan", order_by="BoardList.position"
    )


class BoardList(Base):
    __tablename__ = "lists"
    id: Mapped[int] = mapped_column(primary_key=True)
    board_id: Mapped[int] = mapped_column(ForeignKey("boards.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, default=0)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)  # cards here count as finished
    board: Mapped[Board] = relationship(back_populates="lists")
    cards: Mapped[list["Card"]] = relationship(
        back_populates="board_list", cascade="all, delete-orphan", order_by="Card.position"
    )


class Card(Base):
    __tablename__ = "cards"
    id: Mapped[int] = mapped_column(primary_key=True)
    list_id: Mapped[int] = mapped_column(ForeignKey("lists.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    label: Mapped[str | None] = mapped_column(String(20), nullable=True)  # color key
    position: Mapped[int] = mapped_column(Integer, default=0)
    carried_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    board_list: Mapped[BoardList] = relationship(back_populates="cards")
    attachments: Mapped[list["Attachment"]] = relationship(
        back_populates="card", cascade="all, delete-orphan", order_by="Attachment.id"
    )


class Attachment(Base):
    __tablename__ = "attachments"
    id: Mapped[int] = mapped_column(primary_key=True)
    card_id: Mapped[int] = mapped_column(ForeignKey("cards.id", ondelete="CASCADE"), index=True)
    filename: Mapped[str] = mapped_column(String(300))
    stored_name: Mapped[str] = mapped_column(String(100))
    content_type: Mapped[str] = mapped_column(String(150))
    size: Mapped[int] = mapped_column(Integer)
    poster_name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # jpg frame for videos
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    card: Mapped[Card] = relationship(back_populates="attachments")


class SpecialDay(Base):
    __tablename__ = "special_days"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="event")  # "event" | "motivation"
    color: Mapped[str] = mapped_column(String(20), default="rose")


class DayState(Base):
    __tablename__ = "day_states"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    mood: Mapped[str | None] = mapped_column(String(20), nullable=True)  # motivated|hardday|cozy|dreamy|None
    mood_asked: Mapped[bool] = mapped_column(Boolean, default=False)
    video_shown: Mapped[bool] = mapped_column(Boolean, default=False)


class MonthSetting(Base):
    __tablename__ = "month_settings"
    month: Mapped[str] = mapped_column(String(7), primary_key=True)  # "YYYY-MM"
    motivation_month: Mapped[bool] = mapped_column(Boolean, default=False)


# ---- motivation recommender ----

class SeedVideo(Base):
    __tablename__ = "seed_videos"
    video_id: Mapped[str] = mapped_column(String(20), primary_key=True)


class SeenVideo(Base):
    __tablename__ = "seen_videos"
    video_id: Mapped[str] = mapped_column(String(40), primary_key=True)
    source: Mapped[str] = mapped_column(String(10))  # "youtube" | "local"
    channel_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    title: Mapped[str] = mapped_column(String(300), default="")
    keyword: Mapped[str | None] = mapped_column(String(100), nullable=True)
    liked: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    seen_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Weight(Base):
    """Learned preference weights: kind is 'keyword' or 'channel'."""
    __tablename__ = "weights"
    __table_args__ = (UniqueConstraint("kind", "key"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[float] = mapped_column(Float, default=1.0)


class CandidateVideo(Base):
    """Cache of search results not yet shown (saves API quota)."""
    __tablename__ = "candidate_videos"
    video_id: Mapped[str] = mapped_column(String(20), primary_key=True)
    channel_id: Mapped[str] = mapped_column(String(40), default="")
    title: Mapped[str] = mapped_column(String(300), default="")
    keyword: Mapped[str] = mapped_column(String(100), default="")
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ---- morning push ----

class PushSub(Base):
    __tablename__ = "push_subscriptions"
    id: Mapped[int] = mapped_column(primary_key=True)
    endpoint: Mapped[str] = mapped_column(String(1000), unique=True)
    p256dh: Mapped[str] = mapped_column(String(200))
    auth: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"
    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(Text)


# ---- ritual (Halaldır sənə / Şükür) ----

class Reflection(Base):
    """Evening ritual for one day."""
    __tablename__ = "reflections"
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    gratitude: Mapped[str] = mapped_column(Text, default="[]")  # JSON list of up to 3 strings
    proud: Mapped[str] = mapped_column(Text, default="")  # something I did well today
    tomorrow_task: Mapped[str] = mapped_column(String(500), default="")
    tomorrow_card_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Affirmation(Base):
    """'Özüm haqqında' — sentences she writes about herself; one is shown each morning."""
    __tablename__ = "affirmations"
    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str] = mapped_column(String(300))
