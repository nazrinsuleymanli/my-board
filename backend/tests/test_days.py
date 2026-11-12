def test_special_days_and_calendar(client):
    r = client.post("/api/special-days", json={"day": "2026-11-30", "title": "Appointment", "color": "teal"})
    assert r.status_code == 201
    sid = r.json()["id"]
    assert client.post("/api/special-days", json={"day": "2026-11-30", "title": "x", "kind": "party"}).status_code == 422
    b = client.get("/api/days/2026-11-30/board").json()
    client.post(f"/api/lists/{b['lists'][0]['id']}/cards", json={"title": "a"})
    client.post(f"/api/lists/{b['lists'][2]['id']}/cards", json={"title": "b"})
    client.put("/api/days/2026-11-30/state", json={"mood": "cozy"})
    cal = client.get("/api/calendar/2026-11").json()
    assert cal["days"]["2026-11-30"] == {"total": 2, "done": 1, "mood": "cozy", "ritual": False}
    assert [s["title"] for s in cal["special_days"]] == ["Appointment"]
    assert client.get("/api/calendar/2026-12").json()["special_days"] == []
    assert client.patch(f"/api/special-days/{sid}", json={"title": "Doctor"}).json()["title"] == "Doctor"
    assert client.delete(f"/api/special-days/{sid}").status_code == 204
    assert client.get("/api/calendar/2026-13").status_code == 422


def test_today_flow_mood_then_video(client):
    t = client.get("/api/today", params={"day": "2026-11-12"}).json()
    assert t["should_ask_mood"] and not t["should_show_video"]
    assert client.put("/api/days/2026-11-12/state", json={"mood": "happy"}).status_code == 422
    client.put("/api/days/2026-11-12/state", json={"mood": "motivated", "mood_asked": True})
    t = client.get("/api/today", params={"day": "2026-11-12"}).json()
    assert not t["should_ask_mood"] and t["should_show_video"]
    client.put("/api/days/2026-11-12/state", json={"video_shown": True})
    assert not client.get("/api/today", params={"day": "2026-11-12"}).json()["should_show_video"]


def test_motivation_day_and_month(client):
    client.post("/api/special-days", json={"day": "2026-11-15", "title": "Exam week", "kind": "motivation"})
    client.put("/api/days/2026-11-15/state", json={"mood": "cozy", "mood_asked": True})
    t = client.get("/api/today", params={"day": "2026-11-15"}).json()
    assert t["motivation_day"] and t["should_show_video"]
    assert not client.get("/api/today", params={"day": "2026-11-16"}).json()["motivation_day"]
    client.put("/api/months/2026-11", json={"motivation_month": True})
    assert client.get("/api/today", params={"day": "2026-11-16"}).json()["motivation_day"]
    assert client.get("/api/calendar/2026-11").json()["motivation_month"] is True


def test_month_needs_specials_nudge(client):
    assert client.get("/api/today", params={"day": "2026-12-02"}).json()["month_needs_specials"]
    assert not client.get("/api/today", params={"day": "2026-12-20"}).json()["month_needs_specials"]
    client.post("/api/special-days", json={"day": "2026-12-24", "title": "Christmas market"})
    assert not client.get("/api/today", params={"day": "2026-12-02"}).json()["month_needs_specials"]
    t = client.get("/api/today", params={"day": "2026-12-02"}).json()
    assert [u["title"] for u in t["upcoming"]] == ["Christmas market"]
