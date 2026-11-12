import shutil
import subprocess

import pytest

pytestmark = pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg not installed")


def _make(tmp_path, name, codec_args):
    out = tmp_path / name
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=480x854:rate=30:duration=2",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=2", *codec_args, "-shortest", str(out)],
        check=True,
    )
    return out


def _probe(path):
    return subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    ).stdout.strip()


def _card(client):
    b = client.get("/api/days/2026-11-12/board").json()
    return client.post(f"/api/lists/{b['lists'][1]['id']}/cards", json={"title": "studying at the library"}).json()["id"]


def test_iphone_hevc_mov_becomes_h264_mp4_with_poster(client, tmp_path):
    mov = _make(tmp_path, "IMG_0001.MOV", ["-c:v", "libx265", "-tag:v", "hvc1", "-c:a", "aac"])
    assert _probe(mov) == "hevc"
    cid = _card(client)
    r = client.post(f"/api/cards/{cid}/attachments", files=[("files", ("IMG_0001.MOV", mov.read_bytes(), "video/quicktime"))])
    assert r.status_code == 201, r.text
    a = r.json()[0]
    assert a["filename"] == "IMG_0001.mp4" and a["content_type"] == "video/mp4"
    assert a["poster_url"]
    got = client.get(a["url"])
    assert got.headers["content-type"] == "video/mp4"
    saved = tmp_path / "saved.mp4"
    saved.write_bytes(got.content)
    assert _probe(saved) == "h264"
    poster = client.get(a["poster_url"])
    assert poster.status_code == 200 and poster.content[:2] == b"\xff\xd8"  # jpeg


def test_h264_mp4_kept_as_is_but_gets_poster(client, tmp_path):
    mp4 = _make(tmp_path, "clip.mp4", ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart"])
    cid = _card(client)
    a = client.post(f"/api/cards/{cid}/attachments", files=[("files", ("clip.mp4", mp4.read_bytes(), "video/mp4"))]).json()[0]
    assert a["size"] == mp4.stat().st_size and a["poster_url"]
    # deleting removes poster as well
    assert client.delete(f"/api/attachments/{a['id']}").status_code == 204
    assert client.get(a["poster_url"]).status_code == 404


def test_photo_moment(client):
    cid = _card(client)
    jpg = b"\xff\xd8\xff\xe0" + b"0" * 100
    a = client.post(f"/api/cards/{cid}/attachments", files=[("files", ("photo.jpg", jpg, "image/jpeg"))]).json()[0]
    assert a["content_type"] == "image/jpeg" and a["poster_url"] is None
