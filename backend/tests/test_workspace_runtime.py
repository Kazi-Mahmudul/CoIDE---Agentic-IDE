import json
import os
import sys
from unittest.mock import patch

from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_files_search_does_not_crash_on_workspace_dir():
    from main import app

    client = TestClient(app)
    resp = client.get("/files/search?q=test")
    assert resp.status_code == 200
    body = resp.json()
    assert "results" in body


def test_chat_message_uses_initialized_workspace(monkeypatch):
    from main import app

    async def fake_run_agent(**kwargs):
        assert kwargs.get("workspace_dir")
        yield json.dumps({"type": "done"}) + "\n"

    monkeypatch.setattr("chat.router.run_agent", fake_run_agent)

    client = TestClient(app)
    resp = client.post(
        "/chat/message",
        json={"messages": [{"role": "user", "content": "hello"}], "thread_id": "t1"},
    )
    assert resp.status_code == 200
    assert '"type": "done"' in resp.text


def test_agent_chat_tool_loop_has_workspace(monkeypatch):
    from main import app

    call_count = {"n": 0}

    async def fake_post(self, *args, **kwargs):
        class Resp:
            status_code = 200

            def json(self):
                call_count["n"] += 1
                if call_count["n"] == 1:
                    return {
                        "choices": [{
                            "message": {
                                "role": "assistant",
                                "content": "",
                                "tool_calls": [{
                                    "id": "t1",
                                    "function": {"name": "list_files", "arguments": "{}"},
                                }],
                            }
                        }]
                    }
                return {
                    "choices": [{
                        "message": {
                            "role": "assistant",
                            "content": "done",
                            "tool_calls": [],
                        }
                    }]
                }

            @property
            def text(self):
                return ""

        return Resp()

    async def fake_execute_tool(name, arguments, workspace_dir=None):
        assert workspace_dir
        return "ok"

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)
    monkeypatch.setattr("agent.execute_tool", fake_execute_tool)

    client = TestClient(app)
    resp = client.post(
        "/agent/chat",
        json={
            "messages": [{"role": "user", "content": "list files"}],
            "model_config": {"base_url": "http://fake", "model": "fake-model"},
        },
    )
    assert resp.status_code == 200
    assert '"type": "done"' in resp.text


def test_project_scaffold_generates_multi_file_project():
    from main import app

    client = TestClient(app)
    resp = client.post(
        "/projects/scaffold",
        json={"template": "python-fastapi", "name": "tests/demo-app", "install": False},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert any(p.endswith("main.py") for p in body["created_files"])
