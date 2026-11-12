"""Make phone videos play everywhere: iPhone .mov / HEVC -> H.264 .mp4, plus a poster frame for card covers."""
import json
import shutil
import subprocess
from pathlib import Path

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")


def video_codec(path: Path) -> str | None:
    if not FFPROBE:
        return None
    try:
        out = subprocess.run(
            [FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name", "-of", "json", str(path)],
            capture_output=True, text=True, timeout=30,
        )
        streams = json.loads(out.stdout or "{}").get("streams", [])
        return streams[0]["codec_name"] if streams else None
    except Exception:
        return None


def normalize_video(path: Path) -> Path:
    """Return path of a browser-friendly mp4 (may be the same file). Never raises."""
    if not FFMPEG:
        return path
    codec = video_codec(path)
    if codec == "h264" and path.suffix.lower() == ".mp4":
        return path
    out = path.with_suffix(".mp4") if path.suffix.lower() != ".mp4" else path.with_name(path.stem + "_h264.mp4")
    try:
        subprocess.run(
            [FFMPEG, "-v", "error", "-y", "-i", str(path), "-map_metadata", "-1",
             "-vf", "scale='if(gt(iw,ih),-2,min(720,iw))':'if(gt(iw,ih),min(720,ih),-2)'",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "24", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out)],
            check=True, timeout=300,
        )
        path.unlink(missing_ok=True)
        return out
    except Exception as e:
        print(f"[video] transcode failed, keeping original: {e}")
        out.unlink(missing_ok=True)
        return path


def make_poster(video: Path) -> Path | None:
    if not FFMPEG:
        return None
    poster = video.with_name(video.stem + "_poster.jpg")
    for ss in ("0.5", "0"):
        try:
            subprocess.run(
                [FFMPEG, "-v", "error", "-y", "-ss", ss, "-i", str(video), "-frames:v", "1", "-vf", "scale=640:-2", str(poster)],
                check=True, timeout=60,
            )
            if poster.exists() and poster.stat().st_size > 0:
                return poster
        except Exception:
            continue
    return None
