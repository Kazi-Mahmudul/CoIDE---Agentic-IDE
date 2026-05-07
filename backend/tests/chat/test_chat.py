"""
Backend chat tests.
Run: cd backend && pytest tests/chat/ -v --asyncio-mode=auto
"""
import asyncio
import json
import os
import sys
import tempfile
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_workspace(tmp_path, monkeypatch):
    """Patch WORKSPACE_DIR to a temp directory."""
    ws = str(tmp_path / "workspace")
    os.makedirs(ws, exist_ok=True)
    monkeypatch.setattr("chat.tools.WORKSPACE_DIR", ws)
    monkeypatch.setattr("chat.memory.WORKSPACE_DIR", ws)
    monkeypatch.setattr("chat.context.WORKSPACE_DIR", ws)
    return ws


# ── Test 1: Classifier detects agent mode ─────────────────────────────────────

def test_classifier_detects_agent_mode():
    from chat.classifier import classify
    assert classify("create a FastAPI endpoint for user auth") == "agent"
    assert classify("build a REST API with authentication") == "agent"
    assert classify("fix the bug in main.py") == "agent"
    assert classify("refactor this function to use async/await") == "agent"
    assert classify("write tests for the user service") == "agent"


# ── Test 2: Classifier detects chat mode ──────────────────────────────────────

def test_classifier_detects_chat_mode():
    from chat.classifier import classify
    assert classify("what is dependency injection?") == "chat"
    assert classify("explain how async/await works") == "chat"
    assert classify("what does this code do?") == "chat"
    assert classify("why is Python slow?") == "chat"


# ── Test 3: Classifier respects override ─────────────────────────────────────

def test_classifier_respects_override():
    from chat.classifier import classify
    assert classify("create a file", override="chat") == "chat"
    assert classify("what is Python?", override="agent") == "agent"
    assert classify("anything", override="auto") in ("agent", "chat")


# ── Test 4: Agent stops after max iterations ──────────────────────────────────

@pytest.mark.asyncio
async def test_agent_stops_after_max_iterations(tmp_workspace):
    from chat.agent import run_agent

    # Mock LLM to always return a tool call (infinite loop scenario)
    mock_response = {
        "choices": [{
            "message": {
                "role": "assistant",
                "content": "",
                "tool_calls": [{
                    "id": "t1",
                    "function": {"name": "list_files", "arguments": "{}"}
                }]
            }
        }],
        "usage": {"total_tokens": 100}
    }

    call_count = 0

    async def mock_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        m = MagicMock()
        m.status_code = 200
        m.json.return_value = mock_response
        return m

    with patch("httpx.AsyncClient.post", new=mock_post):
        chunks = []
        async for chunk in run_agent(
            messages=[{"role": "user", "content": "do something"}],
            context={},
            model_config={"base_url": "http://fake", "model": "test"},
            mode="agent",
            settings={"max_iterations": 3},
        ):
            chunks.append(json.loads(chunk))

    # Should have stopped and emitted error about max iterations
    types = [c["type"] for c in chunks]
    assert "error" in types or call_count <= 4  # stopped at max


# ── Test 5: write_file tool creates file ──────────────────────────────────────

@pytest.mark.asyncio
async def test_write_file_tool_creates_file(tmp_workspace):
    from chat.tools import write_file
    result = await write_file("new.py", "print('hello')")
    assert "Written" in result
    assert os.path.isfile(os.path.join(tmp_workspace, "new.py"))
    with open(os.path.join(tmp_workspace, "new.py")) as f:
        assert f.read() == "print('hello')"


# ── Test 6: edit_file replaces string ────────────────────────────────────────

@pytest.mark.asyncio
async def test_edit_file_tool_replaces_string(tmp_workspace):
    from chat.tools import write_file, edit_file
    await write_file("test.py", "def foo():\n    return 1\n")
    result = await edit_file("test.py", "return 1", "return 42")
    assert "Edited" in result
    with open(os.path.join(tmp_workspace, "test.py")) as f:
        assert "return 42" in f.read()


# ── Test 7: edit_file fails on ambiguous match ────────────────────────────────

@pytest.mark.asyncio
async def test_edit_file_fails_on_ambiguous_match(tmp_workspace):
    from chat.tools import write_file, edit_file
    await write_file("dup.py", "x = 1\nx = 1\n")
    result = await edit_file("dup.py", "x = 1", "x = 2")
    assert "Error" in result
    assert "2 times" in result


# ── Test 8: run_command captures output ──────────────────────────────────────

@pytest.mark.asyncio
async def test_run_command_captures_output(tmp_workspace):
    from chat.tools import run_command
    result = await run_command("echo hello world")
    assert "hello world" in result


# ── Test 9: run_command timeout ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_run_command_timeout(tmp_workspace):
    from chat.tools import run_command
    import sys
    if sys.platform == "win32":
        result = await run_command("ping -n 10 127.0.0.1", timeout=1)
    else:
        result = await run_command("sleep 100", timeout=1)
    assert "timed out" in result.lower() or "timeout" in result.lower()


# ── Test 10: checkpoint restore ──────────────────────────────────────────────

def test_checkpoint_restore(tmp_workspace):
    from chat.memory import save_checkpoint, restore_checkpoint
    # Write original file
    fpath = os.path.join(tmp_workspace, "orig.py")
    with open(fpath, "w") as f:
        f.write("original content")
    # Save checkpoint with original
    save_checkpoint("cp_test", {"orig.py": "original content"})
    # Modify file
    with open(fpath, "w") as f:
        f.write("modified content")
    # Restore
    restored = restore_checkpoint("cp_test")
    assert "orig.py" in restored
    with open(fpath) as f:
        assert f.read() == "original content"


# ── Test 11: upload endpoint accepts file ────────────────────────────────────

def test_upload_endpoint_accepts_file():
    from fastapi.testclient import TestClient
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from main import app
    client = TestClient(app)
    content = b"print('hello')"
    resp = client.post(
        "/chat/upload",
        files=[("files", ("test.py", content, "text/plain"))],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "files" in data
    assert data["files"][0]["type"] == "text"
    assert "print" in data["files"][0]["content"]


# ── Test 12: upload rejects oversized file ───────────────────────────────────

def test_upload_rejects_oversized_file():
    from fastapi.testclient import TestClient
    from main import app
    client = TestClient(app)
    big_content = b"x" * (11 * 1024 * 1024)  # 11MB
    resp = client.post(
        "/chat/upload",
        files=[("files", ("big.txt", big_content, "text/plain"))],
    )
    assert resp.status_code == 413


# ── Test 13: context token count ─────────────────────────────────────────────

def test_context_token_count():
    from chat.context import estimate_tokens
    text = "a" * 400
    assert estimate_tokens(text) == 100  # 400 / 4


# ── Test 14: web_search graceful fallback ────────────────────────────────────

@pytest.mark.asyncio
async def test_web_search_tool_graceful_fallback(tmp_workspace, monkeypatch):
    from chat.tools import web_search
    monkeypatch.delenv("SEARCH_API_KEY", raising=False)
    result = await web_search("python async")
    assert "not configured" in result.lower()


# ── Test 15: streaming response format ───────────────────────────────────────

@pytest.mark.asyncio
async def test_streaming_response_format(tmp_workspace):
    from chat.agent import run_agent

    mock_response = {
        "choices": [{"message": {"role": "assistant", "content": "Hello!", "tool_calls": []}}],
        "usage": {"total_tokens": 50}
    }

    async def mock_stream_post(*args, **kwargs):
        m = MagicMock()
        m.status_code = 200
        m.json.return_value = mock_response
        return m

    with patch("httpx.AsyncClient.post", new=mock_stream_post):
        chunks = []
        async for chunk in run_agent(
            messages=[{"role": "user", "content": "hello"}],
            context={},
            model_config={"base_url": "http://fake", "model": "test"},
            mode="chat",
        ):
            parsed = json.loads(chunk)
            chunks.append(parsed)
            assert "type" in parsed

    assert chunks[-1]["type"] == "done"
    types = {c["type"] for c in chunks}
    assert "mode" in types
    assert "done" in types
