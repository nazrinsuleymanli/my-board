def board(client, day, today=False):
    return client.get(f"/api/days/{day}/board", params={"is_today": today}).json()


def add(client, list_id, title):
    return client.post(f"/api/lists/{list_id}/cards", json={"title": title}).json()


def finish_day(client, day, done=2, open_=1):
    b = board(client, day)
    for i in range(done):
        add(client, b["lists"][2]["id"], f"done {day} {i}")
    for i in range(open_):
        add(client, b["lists"][0]["id"], f"open {day} {i}")


def test_evening_ritual_saves_and_puts_tomorrows_task_on_top(client):
    b = board(client, "2026-11-13")
    add(client, b["lists"][0]["id"], "already there")
    r = client.put("/api/reflections/2026-11-12", json={
        "gratitude": ["Ailəm sağdır", "Günəşli gün", " "], "proud": "PA195 tapşırığını bitirdim", "tomorrow_task": "Tezisi yaz"})
    assert r.status_code == 200 and r.json()["done"]
    tm = board(client, "2026-11-13")
    assert [c["title"] for c in tm["lists"][0]["cards"]] == ["Tezisi yaz", "already there"]
    # editing again updates the same card instead of duplicating
    client.put("/api/reflections/2026-11-12", json={"gratitude": ["a"], "proud": "x", "tomorrow_task": "Tezisin 1-ci fəslini yaz"})
    tm = board(client, "2026-11-13")
    assert [c["title"] for c in tm["lists"][0]["cards"]] == ["Tezisin 1-ci fəslini yaz", "already there"]
    got = client.get("/api/reflections/2026-11-12").json()
    assert got["gratitude"] == ["a", "", ""] and got["proud"] == "x"
    assert client.get("/api/calendar/2026-11").json()["days"]["2026-11-12"]["ritual"] is True


def test_streak_counts_good_days_or_ritual_days(client):
    finish_day(client, "2026-11-09")  # 2/3 done -> counts
    finish_day(client, "2026-11-10", done=0, open_=3)  # heavy day...
    client.put("/api/reflections/2026-11-10", json={"gratitude": ["çay"], "proud": ""})  # ...but she did şükür -> counts
    finish_day(client, "2026-11-11", done=1, open_=1)  # half -> counts
    s = client.get("/api/streak", params={"day": "2026-11-12"}).json()
    assert s == {"current": 3, "today_counted": False, "best": 3}
    finish_day(client, "2026-11-12", done=3, open_=0)
    assert client.get("/api/streak", params={"day": "2026-11-12"}).json()["current"] == 4
    # a gap breaks it
    assert client.get("/api/streak", params={"day": "2026-11-15"}).json()["current"] == 0


def test_halal_morning_shows_real_evidence(client):
    finish_day(client, "2026-11-11", done=3, open_=0)
    client.put("/api/reflections/2026-11-11", json={"gratitude": ["anam", "", ""], "proud": "Gym-ə getdim"})
    h = client.get("/api/halal", params={"day": "2026-11-12"}).json()
    assert len(h["done"]) == 3 and h["proud"] == "Gym-ə getdim" and h["gratitude"] == ["anam"]
    assert h["affirmation"] and h["streak"]["current"] == 1
    assert h["line"] == "Halaldır sənə 💛 · Dünən 3 iş bitirdin"
    # empty yesterday still gives a kind line, never a negative one
    e = client.get("/api/halal", params={"day": "2026-12-20"}).json()
    assert e["line"] == "Halaldır sənə 💛" and e["done"] == []


def test_affirmations_and_dua(client):
    a = client.get("/api/affirmations").json()
    assert len(a) == 5
    a = client.post("/api/affirmations", json={"text": "Mən yaxşı mühəndisəm."}).json()
    assert a[-1]["text"] == "Mən yaxşı mühəndisəm."
    client.delete(f"/api/affirmations/{a[0]['id']}")
    assert len(client.get("/api/affirmations").json()) == 5
    d = client.get("/api/dua").json()
    assert d["is_default"] and d["text"].startswith("Allahım")
    long = "Allahım, " + "şükür " * 200
    assert client.put("/api/dua", json={"text": long}).json()["text"] == long.strip()


def test_wins_jar(client):
    finish_day(client, "2026-11-10", done=2, open_=0)
    client.put("/api/reflections/2026-11-10", json={"gratitude": ["dostlar"], "proud": "Kod yazdım"})
    client.put("/api/reflections/2026-11-11", json={"gratitude": ["", "", ""], "proud": ""})  # empty -> not a win
    w = client.get("/api/wins").json()
    assert [x["day"] for x in w] == ["2026-11-10"]
    assert w[0]["finished"] == ["done 2026-11-10 0", "done 2026-11-10 1"] and w[0]["gratitude"] == ["dostlar"]


def test_siri_quick_task_plain_text(client):
    r = client.post("/api/quick/task", json={"text": "atama zəng et."})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/plain")
    assert r.text == "Əlavə etdim: atama zəng et"
    from app.db import SessionLocal
    from app.ritual import server_today
    with SessionLocal() as db:
        today = server_today(db).isoformat()
    titles = [c["title"] for c in board(client, today)["lists"][0]["cards"]]
    assert "Atama zəng et" in titles
    assert client.post("/api/quick/task", json={"text": ""}).status_code == 422
