from datetime import date, datetime
from zoneinfo import ZoneInfo

import app.push as push

PRG = ZoneInfo("Europe/Prague")
SUB = {"endpoint": "https://web.push.apple.com/abc123", "keys": {"p256dh": "BPk3", "auth": "xyz"}}


def test_morning_message_is_positive_and_stable_per_day(client):
    a = client.get("/api/morning", params={"day": "2026-11-12"}).json()
    b = client.get("/api/morning", params={"day": "2026-11-12"}).json()
    c = client.get("/api/morning", params={"day": "2026-11-13"}).json()
    assert a == b and a["quote"] != c["quote"] and a["pisces"] != c["pisces"]
    assert a["pisces"].startswith("♓") and a["greeting"] == "Good morning, Nazrin"
    # 30 days in a row: no repeated quote
    quotes = {client.get("/api/morning", params={"day": f"2026-12-{d:02d}"}).json()["quote"] for d in range(1, 31)}
    assert len(quotes) == 30


def test_vapid_key_is_generated_once(client):
    k1 = client.get("/api/push/key").json()["public_key"]
    k2 = client.get("/api/push/key").json()["public_key"]
    assert k1 == k2 and len(k1) == 87  # 65 raw bytes, base64url without padding


def test_subscribe_test_send_and_cleanup(client, monkeypatch):
    sent = []
    monkeypatch.setattr(push, "webpush_send", lambda sub, payload: sent.append((sub.endpoint, payload)))
    assert client.post("/api/push/test", params={"day": "2026-11-12"}).status_code == 400
    assert client.post("/api/push/subscribe", json=SUB).json()["devices"] == 1
    assert client.post("/api/push/subscribe", json=SUB).json()["devices"] == 1  # idempotent
    r = client.post("/api/push/test", params={"day": "2026-11-12"}).json()
    assert r == {"sent": 1, "removed": 0, "failed": 0}
    endpoint, payload = sent[0]
    assert payload["url"] == "/morning" and "♓" in payload["body"] and payload["title"].startswith("Good morning")
    assert payload["body"].startswith("Halaldır sənə 💛")

    class Gone(Exception):
        response = type("R", (), {"status_code": 410})()

    def gone(sub, payload):
        raise Gone("unsubscribed")

    monkeypatch.setattr(push, "webpush_send", gone)
    assert client.post("/api/push/test", params={"day": "2026-11-12"}).json()["removed"] == 1
    assert client.get("/api/settings/morning").json()["devices"] == 0


def test_is_due_window():
    t = lambda h, m=0: datetime(2026, 11, 12, h, m, tzinfo=PRG)  # noqa: E731
    assert not push.is_due(t(7, 59), "08:00", "", True)
    assert push.is_due(t(8, 0), "08:00", "", True)
    assert push.is_due(t(10, 30), "08:00", "", True)  # server was asleep at 8 — still ok
    assert not push.is_due(t(11, 30), "08:00", "", True)  # but not in the afternoon
    assert not push.is_due(t(8, 5), "08:00", "2026-11-12", True)  # once a day
    assert not push.is_due(t(8, 5), "08:00", "", False)


def test_scheduler_tick_sends_once(client, monkeypatch):
    sent = []
    monkeypatch.setattr(push, "webpush_send", lambda sub, payload: sent.append(payload))
    client.post("/api/push/subscribe", json=SUB)
    client.put("/api/settings/morning", json={"enabled": True, "time": "07:30"})
    utc = ZoneInfo("UTC")
    assert push.tick(datetime(2026, 11, 12, 6, 0, tzinfo=utc)) == []  # 07:00 Prague
    assert push.tick(datetime(2026, 11, 12, 6, 31, tzinfo=utc)) == ["morning"]  # 07:31 Prague
    assert push.tick(datetime(2026, 11, 12, 6, 32, tzinfo=utc)) == []
    assert push.tick(datetime(2026, 11, 12, 20, 31, tzinfo=utc)) == ["evening"]  # 21:31 Prague
    assert len(sent) == 2
    assert sent[0]["body"].startswith("Halaldır sənə") and sent[1]["url"] == "/ritual"
    assert client.put("/api/settings/morning", json={"enabled": True, "time": "25:00"}).status_code == 422
