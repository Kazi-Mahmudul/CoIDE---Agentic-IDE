"""
WebSocket-based PTY terminal.

Windows: uses pywinpty for a real Windows PTY (ConPTY).
Linux/Mac: uses Python pty module with os.fork().

Both implementations:
- Forward bytes WebSocket → PTY stdin
- Forward bytes PTY stdout → WebSocket
- Handle {"type":"resize","cols":N,"rows":N} messages
- Shell starts in the active workspace directory
"""

import os
import sys
import json
import asyncio
import threading
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()

# Default workspace dir — can be overridden per-connection via query param
DEFAULT_WORKSPACE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workspace"
)


def _get_cwd(requested: str | None) -> str:
    """Return a safe working directory for the shell."""
    if requested:
        # Allow any absolute path the user explicitly opened
        p = os.path.normpath(requested)
        if os.path.isdir(p):
            return p
    os.makedirs(DEFAULT_WORKSPACE, exist_ok=True)
    return DEFAULT_WORKSPACE


@router.websocket("/ws/terminal")
async def terminal_ws(websocket: WebSocket):
    cwd_param = websocket.query_params.get("cwd", None)
    cwd = _get_cwd(cwd_param)

    await websocket.accept()

    if sys.platform == "win32":
        await _windows_pty(websocket, cwd)
    else:
        await _unix_pty(websocket, cwd)


# ─────────────────────────── Windows PTY (pywinpty) ───────────────────────────

async def _windows_pty(websocket: WebSocket, cwd: str):
    """
    Real Windows PTY via pywinpty (ConPTY).
    Runs the PTY I/O in a background thread so we don't block the event loop.
    """
    try:
        import winpty
    except ImportError:
        await websocket.send_text(
            "\r\n\x1b[31mpywinpty not installed. Run: pip install pywinpty\x1b[0m\r\n"
        )
        await websocket.close()
        return

    loop = asyncio.get_event_loop()
    stop_event = threading.Event()

    # Detect best available shell
    shell = _find_windows_shell()

    try:
        pty_proc = winpty.PtyProcess.spawn(
            shell,
            cwd=cwd,
            env={**os.environ, "TERM": "xterm-256color"},
            dimensions=(24, 80),
        )
    except Exception as e:
        await websocket.send_text(f"\r\n\x1b[31mFailed to start shell: {e}\x1b[0m\r\n")
        await websocket.close()
        return

    # ── Reader thread: PTY → WebSocket ──────────────────────────────────────
    def reader():
        while not stop_event.is_set():
            try:
                data = pty_proc.read(4096)
                if data:
                    # Schedule send on the event loop from this thread
                    asyncio.run_coroutine_threadsafe(
                        _safe_send_bytes(websocket, data.encode("utf-8", errors="replace")),
                        loop,
                    )
            except EOFError:
                break
            except Exception:
                if not stop_event.is_set():
                    import time; time.sleep(0.05)

    read_thread = threading.Thread(target=reader, daemon=True)
    read_thread.start()

    # ── Main loop: WebSocket → PTY ───────────────────────────────────────────
    try:
        while True:
            msg = await websocket.receive()
            if "text" in msg:
                text = msg["text"]
                try:
                    obj = json.loads(text)
                    if obj.get("type") == "resize":
                        cols = max(1, int(obj.get("cols", 80)))
                        rows = max(1, int(obj.get("rows", 24)))
                        pty_proc.setwinsize(rows, cols)
                        continue
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
                pty_proc.write(text)
            elif "bytes" in msg:
                pty_proc.write(msg["bytes"].decode("utf-8", errors="replace"))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        stop_event.set()
        try:
            pty_proc.terminate(force=True)
        except Exception:
            pass


def _find_windows_shell() -> str:
    """Return the best available shell on Windows."""
    # Prefer PowerShell 7, then PowerShell 5, then cmd
    candidates = [
        os.environ.get("COMSPEC", ""),
        r"C:\Program Files\PowerShell\7\pwsh.exe",
        r"C:\Program Files\PowerShell\7-preview\pwsh.exe",
        "pwsh.exe",
        "powershell.exe",
        "cmd.exe",
    ]
    for c in candidates:
        if not c:
            continue
        if os.path.isabs(c):
            if os.path.isfile(c):
                return c
        else:
            # Search PATH
            import shutil as _shutil
            found = _shutil.which(c)
            if found:
                return found
    return "cmd.exe"


async def _safe_send_bytes(ws: WebSocket, data: bytes):
    try:
        await ws.send_bytes(data)
    except Exception:
        pass


# ─────────────────────────── Unix PTY (pty module) ────────────────────────────

async def _unix_pty(websocket: WebSocket, cwd: str):
    import pty
    import fcntl
    import struct
    import termios
    import signal

    master_fd, slave_fd = pty.openpty()

    pid = os.fork()
    if pid == 0:
        # ── Child ──────────────────────────────────────────────────────────
        os.setsid()
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.close(slave_fd)
        try:
            os.chdir(cwd)
        except Exception:
            pass
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        shell = os.environ.get("SHELL", "/bin/bash")
        os.execvpe(shell, [shell, "--login"], env)
        os._exit(1)

    # ── Parent ─────────────────────────────────────────────────────────────
    os.close(slave_fd)
    flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
    fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

    async def read_pty():
        try:
            while True:
                await asyncio.sleep(0.005)
                try:
                    data = os.read(master_fd, 65536)
                    if data:
                        await websocket.send_bytes(data)
                except BlockingIOError:
                    pass
                except OSError:
                    break
        except Exception:
            pass

    read_task = asyncio.create_task(read_pty())

    try:
        while True:
            msg = await websocket.receive()
            if "text" in msg:
                text = msg["text"]
                try:
                    obj = json.loads(text)
                    if obj.get("type") == "resize":
                        cols = max(1, int(obj.get("cols", 80)))
                        rows = max(1, int(obj.get("rows", 24)))
                        winsize = struct.pack("HHHH", rows, cols, 0, 0)
                        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
                        continue
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
                os.write(master_fd, text.encode("utf-8"))
            elif "bytes" in msg:
                os.write(master_fd, msg["bytes"])
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        read_task.cancel()
        try:
            os.close(master_fd)
        except Exception:
            pass
        try:
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, os.WNOHANG)
        except Exception:
            pass
