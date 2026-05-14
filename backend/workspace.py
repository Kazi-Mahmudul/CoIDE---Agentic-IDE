"""
Workspace lifecycle and path safety helpers.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException

from config import WORKSPACE_DIR


def sanitize_user_id(user_id: str) -> str:
    cleaned = "".join(ch for ch in str(user_id) if ch.isalnum() or ch in ("-", "_"))
    if not cleaned:
        raise HTTPException(status_code=400, detail="Invalid user id")
    return cleaned


def ensure_workspace_root() -> str:
    root = Path(WORKSPACE_DIR).resolve()
    (root / "users").mkdir(parents=True, exist_ok=True)
    return str(root)


def get_user_workspace_dir(user_id: str) -> str:
    root = Path(ensure_workspace_root())
    safe_user_id = sanitize_user_id(user_id)
    user_dir = root / "users" / safe_user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    return str(user_dir.resolve())


def ensure_workspace_dir(workspace_dir: str) -> str:
    resolved = Path(workspace_dir).resolve()
    resolved.mkdir(parents=True, exist_ok=True)
    return str(resolved)


def resolve_workspace_path(workspace_dir: str, path: str) -> str:
    cleaned = path or ""
    for prefix in ("workspace/", "workspace\\"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):]
            break

    resolved = Path(workspace_dir).joinpath(cleaned).resolve()
    workspace = Path(workspace_dir).resolve()
    try:
        resolved.relative_to(workspace)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path traversal not allowed")
    return str(resolved)


def relative_workspace_path(workspace_dir: str, full_path: str) -> str:
    rel = os.path.relpath(full_path, workspace_dir).replace("\\", "/")
    return "." if rel == "." else rel
