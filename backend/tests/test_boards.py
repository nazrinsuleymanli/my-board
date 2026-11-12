def daily(client, day, today=False):
    r = client.get(f"/api/days/{day}/board", params={"is_today": today})
    assert r.status_code == 200
    return r.json()


def test_daily_board_created_with_default_columns(client):
    b = daily(client, "2026-11-12", True)
    assert [l["title"] for l in b["lists"]] == ["To Do", "In Progress", "Done"]
    assert [l["is_done"] for l in b["lists"]] == [False, False, True]
    # same board on second call
    assert daily(client, "2026-11-12")["id"] == b["id"]


def test_card_crud_and_validation(client):
    b = daily(client, "2026-11-12")
    todo = b["lists"][0]["id"]
    r = client.post(f"/api/lists/{todo}/cards", json={"title": "  Call dad ", "time": "18:30", "label": "rose"})
    assert r.status_code == 201
    card = r.json()
    assert card["title"] == "Call dad" and card["time"] == "18:30"
    assert client.post(f"/api/lists/{todo}/cards", json={"title": "x", "time": "6pm"}).status_code == 422
    assert client.post(f"/api/lists/{todo}/cards", json={"title": ""}).status_code == 422
    r = client.patch(f"/api/cards/{card['id']}", json={"description": "ask about weekend", "time": ""})
    assert r.json()["description"] == "ask about weekend" and r.json()["time"] is None
    assert client.delete(f"/api/cards/{card['id']}").status_code == 204
    assert daily(client, "2026-11-12")["lists"][0]["cards"] == []


def test_layout_moves_cards_and_columns(client):
    b = daily(client, "2026-11-12")
    todo, prog, done = (l["id"] for l in b["lists"])
    ids = [client.post(f"/api/lists/{todo}/cards", json={"title": t}).json()["id"] for t in "ABC"]
    layout = {"lists": [
        {"id": done, "card_ids": [ids[2]]},
        {"id": todo, "card_ids": [ids[1]]},
        {"id": prog, "card_ids": [ids[0]]},
    ]}
    r = client.put(f"/api/boards/{b['id']}/layout", json=layout)
    assert r.status_code == 200
    got = r.json()["lists"]
    assert [l["id"] for l in got] == [done, todo, prog]
    assert [[c["title"] for c in l["cards"]] for l in got] == [["C"], ["B"], ["A"]]
    # persisted
    again = client.get(f"/api/boards/{b['id']}").json()["lists"]
    assert [[c["title"] for c in l["cards"]] for l in again] == [["C"], ["B"], ["A"]]


def test_layout_rejects_stale_payload(client):
    b = daily(client, "2026-11-12")
    todo = b["lists"][0]["id"]
    cid = client.post(f"/api/lists/{todo}/cards", json={"title": "A"}).json()["id"]
    stale = {"lists": [{"id": l["id"], "card_ids": []} for l in b["lists"]]}  # card missing
    assert client.put(f"/api/boards/{b['id']}/layout", json=stale).status_code == 409
    foreign = {"lists": [{"id": l["id"], "card_ids": [cid, 9999] if i == 0 else []} for i, l in enumerate(b["lists"])]}
    assert client.put(f"/api/boards/{b['id']}/layout", json=foreign).status_code == 409


def test_carry_over_unfinished_cards_to_today(client):
    y = daily(client, "2026-11-10")
    todo, prog, done = (l["id"] for l in y["lists"])
    client.post(f"/api/lists/{todo}/cards", json={"title": "unfinished todo"})
    client.post(f"/api/lists/{prog}/cards", json={"title": "half done"})
    client.post(f"/api/lists/{done}/cards", json={"title": "finished"})
    # looking at a future day must NOT steal cards
    assert all(not l["cards"] for l in daily(client, "2026-11-20")["lists"])
    t = daily(client, "2026-11-12", today=True)
    titles = {l["title"]: [c["title"] for c in l["cards"]] for l in t["lists"]}
    assert titles == {"To Do": ["unfinished todo"], "In Progress": ["half done"], "Done": []}
    assert t["lists"][0]["cards"][0]["carried_from"] == "2026-11-10"
    old = daily(client, "2026-11-10")
    assert [c["title"] for c in old["lists"][2]["cards"]] == ["finished"]
    assert old["lists"][0]["cards"] == []
    # only once per day
    t2 = daily(client, "2026-11-12", today=True)
    assert len(t2["lists"][0]["cards"]) == 1


def test_board_viewed_earlier_still_gets_carry_over_when_it_becomes_today(client):
    daily(client, "2026-11-13")  # opened from the calendar a day early
    y = daily(client, "2026-11-12")
    client.post(f"/api/lists/{y['lists'][0]['id']}/cards", json={"title": "late task"})
    t = daily(client, "2026-11-13", today=True)
    assert [c["title"] for c in t["lists"][0]["cards"]] == ["late task"]


def test_move_card_to_tomorrow(client):
    b = daily(client, "2026-11-12")
    cid = client.post(f"/api/lists/{b['lists'][1]['id']}/cards", json={"title": "later"}).json()["id"]
    r = client.post(f"/api/cards/{cid}/move-to-day", json={"day": "2026-11-13"})
    assert r.status_code == 200
    tm = daily(client, "2026-11-13")
    assert [c["title"] for c in tm["lists"][1]["cards"]] == ["later"]
    assert daily(client, "2026-11-12")["lists"][1]["cards"] == []


def test_custom_boards_and_lists(client):
    r = client.post("/api/boards", json={"title": "Thesis"})
    assert r.status_code == 201
    bid = r.json()["id"]
    l = client.post(f"/api/boards/{bid}/lists", json={"title": "Ideas"}).json()
    assert l["position"] == 3
    assert client.patch(f"/api/lists/{l['id']}", json={"title": "Reading"}).json()["title"] == "Reading"
    assert client.delete(f"/api/lists/{l['id']}").status_code == 204
    assert [b["title"] for b in client.get("/api/boards").json()] == ["Thesis"]
    daily_id = daily(client, "2026-11-12")["id"]
    assert client.delete(f"/api/boards/{daily_id}").status_code == 400
    assert client.delete(f"/api/boards/{bid}").status_code == 204
    assert client.get("/api/boards").json() == []


def test_attachments_any_type(client):
    b = daily(client, "2026-11-12")
    cid = client.post(f"/api/lists/{b['lists'][0]['id']}/cards", json={"title": "docs"}).json()["id"]
    files = [
        ("files", ("notes.pdf", b"%PDF-1.4 fake", "application/pdf")),
        ("files", ("voice.m4a", b"\x00\x01audio", "audio/mp4")),
        ("files", ("weird.xyz", b"whatever", "")),
    ]
    r = client.post(f"/api/cards/{cid}/attachments", files=files)
    assert r.status_code == 201, r.text
    atts = r.json()
    assert [a["filename"] for a in atts] == ["notes.pdf", "voice.m4a", "weird.xyz"]
    f = client.get(atts[0]["url"])
    assert f.status_code == 200 and f.content == b"%PDF-1.4 fake"
    assert f.headers["content-type"].startswith("application/pdf")
    assert client.delete(f"/api/attachments/{atts[1]['id']}").status_code == 204
    card = client.get(f"/api/boards/{b['id']}").json()["lists"][0]["cards"][0]
    assert len(card["attachments"]) == 2


def test_late_additions_to_yesterday_still_carry_over(client):
    daily(client, "2026-11-12", today=True)
    y = daily(client, "2026-11-11")
    client.post(f"/api/lists/{y['lists'][0]['id']}/cards", json={"title": "added late"})
    t = daily(client, "2026-11-12", today=True)
    assert [c["title"] for c in t["lists"][0]["cards"]] == ["added late"]
