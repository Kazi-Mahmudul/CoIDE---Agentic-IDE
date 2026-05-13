"""
Git API endpoints for IDE Source Control panel.
"""

from __future__ import annotations

import subprocess
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import UserContext, get_current_user, get_workspace_dir

router = APIRouter(prefix="/git", tags=["git"])


def _run_git(workspace_dir: str, *args: str, timeout: int = 10) -> str:
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Git execution failed: {e}")
    if proc.returncode != 0:
        msg = proc.stderr.strip() or proc.stdout.strip() or f"git {' '.join(args)} failed"
        raise HTTPException(status_code=400, detail=msg)
    return proc.stdout


def _parse_status_porcelain(raw: str) -> dict:
    staged = []
    changes = []
    untracked = []
    for line in raw.splitlines():
        if len(line) < 3:
            continue
        x = line[0]
        y = line[1]
        path = line[3:].strip()
        name = path.split("/")[-1]
        if x == "?" and y == "?":
            untracked.append({"path": path, "name": name, "status": "??"})
        else:
            if x != " ":
                staged.append({"path": path, "name": name, "status": x})
            if y != " ":
                changes.append({"path": path, "name": name, "status": y})
    return {"staged": staged, "changes": changes, "untracked": untracked}


@router.get("/status")
async def git_status(user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    _run_git(workspace_dir, "rev-parse", "--is-inside-work-tree")
    branch = _run_git(workspace_dir, "rev-parse", "--abbrev-ref", "HEAD").strip()
    porcelain = _run_git(workspace_dir, "status", "--porcelain")
    parsed = _parse_status_porcelain(porcelain)
    return {"branch": branch, **parsed}


@router.get("/diff")
async def git_diff(path: Optional[str] = None, staged: bool = False, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    args = ["diff"]
    if staged:
        args.append("--cached")
    if path:
        args.extend(["--", path])
    return {"diff": _run_git(workspace_dir, *args, timeout=20)}


class GitCommitBody(BaseModel):
    message: str


@router.post("/commit")
async def git_commit(body: GitCommitBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Commit message is required")
    _run_git(workspace_dir, "add", "-A")
    out = _run_git(workspace_dir, "commit", "-m", body.message.strip(), timeout=20)
    return {"status": "ok", "output": out.strip()}
