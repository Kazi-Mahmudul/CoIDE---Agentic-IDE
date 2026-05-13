"""
Conversation memory: stores threads, checkpoints, summarization.
In-memory with localStorage-style persistence via JSON file.
"""
from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Optional

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import WORKSPACE_DIR
# ── Checkpoint storage ────────────────────────────────────────────────────────
# checkpoint_id → {files: {path: original_content}}
_checkpoints: dict[str, dict] = {}
MAX_CHECKPOINTS = 20


def save_checkpoint(checkpoint_id: str, user_id: str | dict, changed_files: dict[str, str] | None = None) -> None:
    """Save original file contents before agent modifies them."""
    if changed_files is None and isinstance(user_id, dict):
        changed_files = user_id
        user_id = "legacy"
    if changed_files is None:
        changed_files = {}
    _checkpoints[checkpoint_id] = {
        "id": checkpoint_id,
        "user_id": user_id,
        "timestamp": time.time(),
        "files": changed_files,  # path → original content (or None if file didn't exist)
    }
    # Trim old checkpoints
    if len(_checkpoints) > MAX_CHECKPOINTS:
        oldest = sorted(_checkpoints.keys(), key=lambda k: _checkpoints[k]["timestamp"])
        for k in oldest[:len(_checkpoints) - MAX_CHECKPOINTS]:
            del _checkpoints[k]


def restore_checkpoint(checkpoint_id: str, user_id: str = "legacy", workspace_dir: str | None = None) -> list[str]:
    """Restore files to their pre-agent state. Returns list of restored paths."""
    workspace_dir = workspace_dir or WORKSPACE_DIR
    cp = _checkpoints.get(checkpoint_id)
    if not cp:
        raise ValueError(f"Checkpoint {checkpoint_id} not found")
    if cp.get("user_id") not in (user_id, "legacy"):
        raise ValueError("Checkpoint ownership mismatch")

    restored = []
    for path, original_content in cp["files"].items():
        full = os.path.normpath(os.path.join(workspace_dir, path))
        if original_content is None:
            # File didn't exist before — delete it
            if os.path.exists(full):
                os.remove(full)
                restored.append(f"deleted:{path}")
        else:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as f:
                f.write(original_content)
            restored.append(path)

    return restored


def get_checkpoint(checkpoint_id: str, user_id: str = "legacy") -> Optional[dict]:
    cp = _checkpoints.get(checkpoint_id)
    if cp and cp.get("user_id") == user_id:
        return cp
    return None


def read_file_for_checkpoint(path: str, workspace_dir: str | None = None) -> Optional[str]:
    """Read current file content for checkpoint (returns None if file doesn't exist)."""
    workspace_dir = workspace_dir or WORKSPACE_DIR
    full = os.path.normpath(os.path.join(workspace_dir, path))
    if not os.path.isfile(full):
        return None
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None
