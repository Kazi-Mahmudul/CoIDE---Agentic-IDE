"""
Runtime/command execution endpoints used by IDE workflows.
"""

from __future__ import annotations

import asyncio
import shlex
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import UserContext, get_current_user, get_workspace_dir

router = APIRouter(prefix="/runtime", tags=["runtime"])

MAX_OUTPUT = 200_000
MAX_TIMEOUT = 120


class CommandBody(BaseModel):
    command: str
    cwd: str | None = None
    timeout: int = 30


def _safe_cwd(workspace_dir: str, cwd: str | None) -> str:
    if not cwd:
        return workspace_dir
    resolved = Path(workspace_dir).joinpath(cwd).resolve()
    workspace = Path(workspace_dir).resolve()
    try:
        resolved.relative_to(workspace)
    except ValueError:
        raise HTTPException(status_code=400, detail="cwd must stay inside workspace")
    return str(resolved)


def _parse_command(command: str) -> list[str]:
    command = command.strip()
    if not command:
        raise HTTPException(status_code=400, detail="Command is required")
    try:
        return shlex.split(command, posix=False)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid command syntax: {e}")


@router.post("/exec")
async def run_command(body: CommandBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    cwd = _safe_cwd(workspace_dir, body.cwd)
    timeout = max(1, min(body.timeout, MAX_TIMEOUT))
    argv = _parse_command(body.command)
    started = time.perf_counter()

    try:
        proc = await asyncio.create_subprocess_exec(
            *argv,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except FileNotFoundError:
        raise HTTPException(status_code=400, detail=f"Command not found: {argv[0]}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start command: {e}")

    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.communicate()
        raise HTTPException(status_code=408, detail=f"Command timed out after {timeout}s")

    out_text = stdout.decode("utf-8", errors="replace")
    err_text = stderr.decode("utf-8", errors="replace")
    if len(out_text) > MAX_OUTPUT:
        out_text = out_text[:MAX_OUTPUT] + "\n[output truncated]"
    if len(err_text) > MAX_OUTPUT:
        err_text = err_text[:MAX_OUTPUT] + "\n[stderr truncated]"

    return {
        "status": "ok",
        "return_code": proc.returncode,
        "stdout": out_text,
        "stderr": err_text,
        "command": argv,
        "cwd": cwd,
        "duration_ms": int((time.perf_counter() - started) * 1000),
    }
