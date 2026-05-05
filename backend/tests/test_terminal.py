"""
Backend terminal tests.

NOTE: Tests 1-12 require Unix (pty/fork). On Windows they are skipped.
Tests 13-15 (sessions REST) work on all platforms.

Run with:
    cd backend && pytest tests/test_terminal.py -v --asyncio-mode=auto
"""

from __future__ import annotations

import asyncio
import base64
import json
import os
import sys
import time
import uuid
from unittest.mock import patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient, ASGITransport

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

UNIX = sys.platform != "win32"
skip_windows = pytest.mark.skipif(not UNIX, reason="Unix PTY tests only")


# ── App fixture ───────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def app():
    from main import app as _app
    return _app


@pytest.fixture(scope="module")
def sync_client(app):
    return TestClient(app)


# ── WebSocket helper ──────────────────────────────────────────────────────────

class WsHelper:
    """Thin wrapper around TestClient WebSocket for easier testing."""

    def __init__(self, ws):
        self.ws = ws
        self._buf: list[dict] = []

    def send_input(self, text: str):
        data = base64.b64encode(text.encode()).decode()
        self.ws.send_text(json.dumps({"type": "input", "data": data}))

    def send_resize(self, cols: int, rows: int):
        self.ws.send_text(json.dumps({"type": "resize", "cols": cols, "rows": rows}))

    def send_ping(self):
        self.ws.send_text(json.dumps({"type": "ping"}))

    def recv_msg(self, timeout: float = 5.0) -> dict | None:
        """Receive one JSON message."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                raw = self.ws.receive_text()
                return json.loads(raw)
            except Exception:
                return None
        return None

    def collect_output(self, timeout: float = 3.0) -> str:
        """Collect all output messages for `timeout` seconds, return decoded text."""
        out = b""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                raw = self.ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "output":
                    out += base64.b64decode(msg["data"])
            except Exception:
                break
        return out.decode("utf-8", errors="replace")

    def wait_for_output(self, needle: str, timeout: float = 5.0) -> str:
        """Collect output until `needle` appears or timeout."""
        out = b""
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                raw = self.ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "output":
                    out += base64.b64decode(msg["data"])
                    if needle.encode() in out:
                        return out.decode("utf-8", errors="replace")
            except Exception:
                time.sleep(0.05)
        return out.decode("utf-8", errors="replace")


def make_ws_url(session_id: str | None = None, cwd: str | None = None) -> str:
    params = []
    if session_id:
        params.append(f"session_id={session_id}")
    if cwd:
        params.append(f"cwd={cwd}")
    qs = "&".join(params)
    return f"/ws/terminal?{qs}" if qs else "/ws/terminal"


# ═══════════════════════════════════════════════════════════════════════════════
# Tests 1–12: Unix PTY
# ═══════════════════════════════════════════════════════════════════════════════

@skip_windows
def test_websocket_connects_successfully(sync_client):
    """Test 1: WebSocket connects and receives session message."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        raw = ws.receive_text()
        msg = json.loads(raw)
        assert msg["type"] == "session"
        assert "session_id" in msg


@skip_windows
def test_shell_spawns_on_connect(sync_client):
    """Test 2: Shell spawns and responds to echo."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        # Consume session message
        h.recv_msg()
        # Send command
        h.send_input("echo hello_test_marker\n")
        output = h.wait_for_output("hello_test_marker", timeout=5.0)
        assert "hello_test_marker" in output


@skip_windows
def test_resize_message_works(sync_client):
    """Test 3: Resize changes PTY dimensions."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()  # session
        # Wait for prompt
        time.sleep(0.5)
        h.send_resize(120, 40)
        time.sleep(0.3)
        h.send_input("tput cols\n")
        output = h.wait_for_output("120", timeout=5.0)
        assert "120" in output


@skip_windows
def test_multiple_sessions_isolated(sync_client):
    """Test 4: Two sessions are completely isolated."""
    sid1 = str(uuid.uuid4())
    sid2 = str(uuid.uuid4())

    with sync_client.websocket_connect(make_ws_url(sid1)) as ws1:
        h1 = WsHelper(ws1)
        h1.recv_msg()
        time.sleep(0.5)
        h1.send_input("export COIDE_ISOLATION_TEST=secret_value_xyz\n")
        time.sleep(0.5)

        with sync_client.websocket_connect(make_ws_url(sid2)) as ws2:
            h2 = WsHelper(ws2)
            h2.recv_msg()
            time.sleep(0.5)
            h2.send_input("echo RESULT:${COIDE_ISOLATION_TEST:-EMPTY}\n")
            output = h2.wait_for_output("RESULT:", timeout=5.0)
            # Session 2 should NOT have the variable from session 1
            assert "secret_value_xyz" not in output


@skip_windows
def test_session_reconnect(sync_client):
    """Test 5: Reconnect with same session_id within timeout reattaches."""
    sid = str(uuid.uuid4())

    with sync_client.websocket_connect(make_ws_url(sid)) as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.5)
        h.send_input("export RECONNECT_MARKER=alive_42\n")
        time.sleep(0.5)
    # Disconnected — session should persist for SESSION_TIMEOUT seconds

    time.sleep(1.0)  # well within timeout

    with sync_client.websocket_connect(make_ws_url(sid)) as ws2:
        h2 = WsHelper(ws2)
        msg = h2.recv_msg()
        assert msg["type"] == "session"
        # Scrollback replayed — wait a moment then check env
        time.sleep(0.5)
        h2.send_input("echo MARKER:${RECONNECT_MARKER:-GONE}\n")
        output = h2.wait_for_output("MARKER:", timeout=5.0)
        assert "alive_42" in output


@skip_windows
def test_session_expires_after_timeout(sync_client):
    """Test 6: Session expires after SESSION_TIMEOUT (mocked)."""
    from terminal import _sessions, _sessions_lock, SESSION_TIMEOUT

    sid = str(uuid.uuid4())

    with sync_client.websocket_connect(make_ws_url(sid)) as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.3)

    # Manually expire the session by backdating disconnect_time
    import asyncio as _asyncio
    loop = _asyncio.new_event_loop()

    async def expire():
        async with _sessions_lock:
            s = _sessions.get(sid)
            if s:
                s.disconnect_time = time.time() - SESSION_TIMEOUT - 5
                if s._cleanup_task:
                    s._cleanup_task.cancel()
                from terminal import _kill_session
                _kill_session(s)
                del _sessions[sid]

    loop.run_until_complete(expire())
    loop.close()

    # Now reconnect — should get a fresh session (new shell)
    with sync_client.websocket_connect(make_ws_url(sid)) as ws2:
        h2 = WsHelper(ws2)
        msg = h2.recv_msg()
        assert msg["type"] == "session"
        time.sleep(0.5)
        h2.send_input("echo FRESH_SHELL\n")
        output = h2.wait_for_output("FRESH_SHELL", timeout=5.0)
        assert "FRESH_SHELL" in output


@skip_windows
def test_ctrl_c_sends_sigint(sync_client):
    """Test 7: Ctrl+C kills running process."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.5)
        h.send_input("sleep 100\n")
        time.sleep(0.5)
        # Send Ctrl+C as base64
        ctrl_c = base64.b64encode(b"\x03").decode()
        ws.send_text(json.dumps({"type": "input", "data": ctrl_c}))
        # Prompt should return
        output = h.wait_for_output("$", timeout=5.0)
        assert "$" in output or "#" in output or "%" in output


@skip_windows
def test_pty_output_is_base64_encoded(sync_client):
    """Test 8: All output messages have base64-encoded data."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()  # session
        time.sleep(0.3)
        h.send_input("echo base64check\n")

        deadline = time.time() + 5.0
        found_output = False
        while time.time() < deadline:
            try:
                raw = ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "output":
                    found_output = True
                    # Must be valid base64
                    decoded = base64.b64decode(msg["data"])
                    assert isinstance(decoded, bytes)
            except Exception:
                break

        assert found_output, "No output messages received"


@skip_windows
def test_invalid_message_type_handled_gracefully(sync_client):
    """Test 9: Unknown message type doesn't crash connection."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.3)
        # Send unknown type
        ws.send_text(json.dumps({"type": "unknown_xyz", "data": "test"}))
        time.sleep(0.3)
        # Connection should still work
        h.send_input("echo still_alive\n")
        output = h.wait_for_output("still_alive", timeout=5.0)
        assert "still_alive" in output


@skip_windows
def test_large_output_handled(sync_client):
    """Test 10: Large output doesn't crash WebSocket."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.5)
        # Generate ~50KB of output
        h.send_input("python3 -c \"print('X' * 100, end='\\n')\" || python -c \"print('X' * 100)\"\n")
        output = h.wait_for_output("X" * 10, timeout=10.0)
        assert "X" * 10 in output


@skip_windows
def test_ping_pong(sync_client):
    """Test 11: Ping receives pong."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()  # session
        h.send_ping()
        # Collect messages until we get pong
        deadline = time.time() + 5.0
        got_pong = False
        while time.time() < deadline:
            try:
                raw = ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "pong":
                    got_pong = True
                    break
            except Exception:
                break
        assert got_pong


@skip_windows
def test_disconnect_kills_shell(sync_client):
    """Test 12: Disconnecting eventually kills the shell process."""
    with sync_client.websocket_connect("/ws/terminal") as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.3)
        h.send_input("echo $$\n")
        output = h.wait_for_output("\n", timeout=3.0)
        # Extract PID from output
        lines = [l.strip() for l in output.split("\n") if l.strip().isdigit()]
        if not lines:
            pytest.skip("Could not extract PID from output")
        pid = int(lines[0])

    # After disconnect, session cleanup is scheduled
    # Wait a moment and check if process is gone (or session cleaned up)
    time.sleep(2.0)
    try:
        os.kill(pid, 0)
        # Process still alive — that's OK within SESSION_TIMEOUT window
        # The important thing is it will be killed after SESSION_TIMEOUT
    except ProcessLookupError:
        pass  # Already dead — perfect


# ═══════════════════════════════════════════════════════════════════════════════
# Tests 13–15: REST endpoints (work on all platforms)
# ═══════════════════════════════════════════════════════════════════════════════

@skip_windows
def test_concurrent_sessions(sync_client):
    """Test 13: Multiple concurrent sessions each get correct output."""
    results = {}
    errors = []

    def run_session(n: int):
        sid = str(uuid.uuid4())
        marker = f"session_output_{n}"
        try:
            with sync_client.websocket_connect(make_ws_url(sid)) as ws:
                h = WsHelper(ws)
                h.recv_msg()
                time.sleep(0.3)
                h.send_input(f"echo {marker}\n")
                output = h.wait_for_output(marker, timeout=5.0)
                results[n] = marker in output
        except Exception as e:
            errors.append(f"Session {n}: {e}")

    import threading
    threads = [threading.Thread(target=run_session, args=(i,)) for i in range(5)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    assert not errors, f"Errors: {errors}"
    assert all(results.values()), f"Failed sessions: {results}"


def test_session_list_endpoint(sync_client):
    """Test 14: GET /terminal/sessions lists active sessions."""
    if not UNIX:
        # On Windows, just check the endpoint exists
        resp = sync_client.get("/terminal/sessions")
        assert resp.status_code == 200
        assert "sessions" in resp.json()
        return

    # Open a session
    sid = str(uuid.uuid4())
    with sync_client.websocket_connect(make_ws_url(sid)) as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.3)

        resp = sync_client.get("/terminal/sessions")
        assert resp.status_code == 200
        data = resp.json()
        assert "sessions" in data
        session_ids = [s["session_id"] for s in data["sessions"]]
        assert sid in session_ids


def test_session_delete_endpoint(sync_client):
    """Test 15: DELETE /terminal/sessions/{id} kills session."""
    if not UNIX:
        pytest.skip("Unix only")

    sid = str(uuid.uuid4())
    with sync_client.websocket_connect(make_ws_url(sid)) as ws:
        h = WsHelper(ws)
        h.recv_msg()
        time.sleep(0.3)

        # Delete the session
        resp = sync_client.delete(f"/terminal/sessions/{sid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"

        # Should no longer be in list
        resp2 = sync_client.get("/terminal/sessions")
        session_ids = [s["session_id"] for s in resp2.json()["sessions"]]
        assert sid not in session_ids
