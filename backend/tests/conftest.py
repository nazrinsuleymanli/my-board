import os
import tempfile

os.environ["DATA_DIR"] = tempfile.mkdtemp(prefix="myboard-test-")
os.environ.pop("YOUTUBE_API_KEY", None)
os.environ["DISABLE_SCHEDULER"] = "1"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app) as c:
        yield c
