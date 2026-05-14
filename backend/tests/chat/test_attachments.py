import json
import os
import sys
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


@pytest.fixture
def tmp_workspace(tmp_path, monkeypatch):
    ws = str(tmp_path / "workspace")
    os.makedirs(ws, exist_ok=True)
    monkeypatch.setattr("chat.tools.WORKSPACE_DIR", ws)
    monkeypatch.setattr("chat.memory.WORKSPACE_DIR", ws)
    monkeypatch.setattr("chat.context.WORKSPACE_DIR", ws)
    return ws


@pytest.mark.asyncio
async def test_run_agent_injects_image_into_payload(tmp_workspace):
    from chat.agent import run_agent

    payloads = []

    async def mock_post(self, *args, **kwargs):
        payloads.append(kwargs.get("json", {}))
        m = MagicMock()
        m.status_code = 200
        m.json.return_value = {
            "choices": [{"message": {"role": "assistant", "content": "ok", "tool_calls": []}}],
            "usage": {"total_tokens": 10},
        }
        return m

    with patch("httpx.AsyncClient.post", new=mock_post):
        chunks = []
        async for chunk in run_agent(
            messages=[{"role": "user", "content": "Analyze this image"}],
            context={
                "attached_images": [{
                    "id": "img1",
                    "filename": "flow.png",
                    "media_type": "image/png",
                    "base64": "aGVsbG8=",
                }]
            },
            model_config={"base_url": "http://fake", "model": "test"},
            mode="chat",
        ):
            chunks.append(json.loads(chunk))

    assert any(c.get("type") == "done" for c in chunks)
    assert payloads, "No request payload captured"
    req_messages = payloads[0]["messages"]
    last_user = req_messages[-1]
    assert isinstance(last_user["content"], list)
    assert any(p.get("type") == "image_url" for p in last_user["content"])


def test_upload_manifest_and_retrieval(tmp_workspace):
    from chat.uploads import _session_dir, _save_manifest, get_upload, list_uploads, load_recent_images

    session_id = "thread-1"
    session_dir = _session_dir(session_id, workspace_dir=tmp_workspace, user_id="u1")
    img_path = os.path.join(session_dir, "abc_flow.png")
    with open(img_path, "wb") as f:
        f.write(b"fake-image-data")
    _save_manifest(session_dir, {
        "files": [{
            "id": "abc",
            "filename": "flow.png",
            "type": "image",
            "media_type": "image/png",
            "size": 15,
            "storage_path": img_path,
        }]
    })

    files = list_uploads(session_id, workspace_dir=tmp_workspace, user_id="u1")
    assert len(files) == 1
    meta = get_upload("abc", session_id, workspace_dir=tmp_workspace, user_id="u1")
    assert meta and meta["filename"] == "flow.png"
    hydrated = load_recent_images(session_id, workspace_dir=tmp_workspace, user_id="u1")
    assert hydrated and hydrated[0]["base64"]
