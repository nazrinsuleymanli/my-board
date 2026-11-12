import pytest

import app.motivation as mot
from app.db import VIDEO_DIR
from app.media import SEED_VIDEO


@pytest.fixture(autouse=True)
def three_vlogs():
    """Tests must not depend on personal videos being in the repo: use exactly 3 dummy vlogs."""
    for p in SEED_VIDEO.glob("*.mp4"):
        p.rename(p.with_suffix(".mp4.hidden"))
    made = [VIDEO_DIR / f"vlog_test{i}.mp4" for i in range(3)]
    for p in made:
        p.write_bytes(b"\x00\x00\x00\x18ftypmp42")
    yield
    for p in made:
        p.unlink(missing_ok=True)
    for p in SEED_VIDEO.glob("*.mp4.hidden"):
        p.rename(p.with_suffix(""))


def test_no_personal_photos_shipped_by_default(client):
    bg = client.get("/api/backgrounds").json()
    assert all(v == [] for v in bg.values())  # themes use drawn scenes; custom pictures are opt-in


def test_background_upload_and_delete(client):
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 20
    r = client.post("/api/backgrounds/cozy", files={"file": ("tea.png", png, "image/png")})
    assert r.status_code == 201
    item = r.json()["cozy"][0]
    assert item["removable"]
    assert client.get(item["url"]).status_code == 200
    assert client.post("/api/backgrounds/cozy", files={"file": ("x.txt", b"hi", "text/plain")}).status_code == 422
    assert client.delete(f"/api/backgrounds/{item['name']}").status_code == 204
    assert client.get("/api/backgrounds").json()["cozy"] == []


def test_local_videos_served_as_mp4(client):
    vids = client.get("/api/videos").json()
    assert len(vids) == 3
    r = client.get(vids[0]["url"])
    assert r.status_code == 200 and r.headers["content-type"] == "video/mp4"


def test_without_api_key_seeds_first_then_own_vlogs(client):
    got = [client.get("/api/motivation/next").json() for _ in range(3)]
    assert [g["id"] for g in got] == mot.DEFAULT_SEEDS
    assert all(g["source"] == "youtube" and "youtube-nocookie.com/embed/" in g["embed_url"] for g in got)
    nxt = [client.get("/api/motivation/next").json() for _ in range(4)]
    assert [n["source"] for n in nxt] == ["local"] * 4
    assert len({n["id"] for n in nxt[:3]}) == 3  # rotates through all 3 vlogs before repeating


def test_seed_links_parsed(client):
    assert mot.video_id_from("https://www.youtube.com/shorts/_nadnfsta_8") == "_nadnfsta_8"
    assert mot.video_id_from("http://youtube.com/shorts/GtdwU4Myd-U") == "GtdwU4Myd-U"
    assert mot.video_id_from("https://youtu.be/AzI3lD4m0Ms?si=x") == "AzI3lD4m0Ms"
    assert mot.video_id_from("not a link") is None
    r = client.post("/api/motivation/seeds", json={"url": "https://www.youtube.com/watch?v=abcdefghijk"})
    assert "abcdefghijk" in [s["id"] for s in r.json()]
    assert client.post("/api/motivation/seeds", json={"url": "hello"}).status_code == 422


def test_recommender_with_fake_youtube(client, monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "test")
    monkeypatch.setattr(mot, "LOCAL_SHARE", 0.0)
    calls = []

    def fake_yt(path, params):
        calls.append((path, params.get("q")))
        if path == "videos":
            return {"items": [{"snippet": {"channelId": "chanSeed", "title": "Discipline beats talent", "tags": ["study motivation"]}}]}
        return {"items": [
            {"id": {"videoId": f"vid{i:08d}"}, "snippet": {"channelId": "chanSeed" if i == 3 else f"ch{i}", "title": f"t{i}"}}
            for i in range(6)
        ] + [{"id": {"videoId": mot.DEFAULT_SEEDS[0]}, "snippet": {"channelId": "x", "title": "seen"}}]}

    monkeypatch.setattr(mot, "yt_get", fake_yt)
    for _ in range(3):  # seeds first
        client.get("/api/motivation/next")
    first = client.get("/api/motivation/next").json()
    assert first["source"] == "youtube"
    assert first["id"] == "vid00000003"  # seed channel got a boost (1.5x beats the ±15% jitter)
    assert ("videos", None) in calls
    shown = {first["id"]}
    for _ in range(4):
        shown.add(client.get("/api/motivation/next").json()["id"])
    assert len(shown) == 5 and mot.DEFAULT_SEEDS[0] not in shown  # never repeats, skips already-seen

    # feedback moves weights
    disliked = sorted(v for v in shown if v != "vid00000003")[0]
    r = client.post("/api/motivation/feedback", json={"video_id": disliked, "liked": False})
    assert r.status_code == 200
    from app.db import SessionLocal
    from app.models import Weight
    with SessionLocal() as db:
        w = db.query(Weight).filter_by(kind="channel", key=f"ch{int(disliked[3:])}").one()
        assert w.value < 1.0
        seed_ch = db.query(Weight).filter_by(kind="channel", key="chanSeed").one()
        assert seed_ch.value > 1.0


def test_youtube_failure_falls_back_to_vlog(client, monkeypatch):
    monkeypatch.setenv("YOUTUBE_API_KEY", "test")
    monkeypatch.setattr(mot, "LOCAL_SHARE", 0.0)

    def broken(path, params):
        raise RuntimeError("quota exceeded")

    monkeypatch.setattr(mot, "yt_get", broken)
    for _ in range(3):
        client.get("/api/motivation/next")
    r = client.get("/api/motivation/next")
    assert r.status_code == 200 and r.json()["source"] == "local"
