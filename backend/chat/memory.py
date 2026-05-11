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


def save_checkpoint(checkpoint_id: str, changed_files: dict[str, str]) -> None:
    """Save original file contents before agent modifies them."""
    _checkpoints[checkpoint_id] = {
        "id": checkpoint_id,
        "timestamp": time.time(),
        "files": changed_files,  # path → original content (or None if file didn't exist)
    }
    # Trim old checkpoints
    if len(_checkpoints) > MAX_CHECKPOINTS:
        oldest = sorted(_checkpoints.keys(), key=lambda k: _checkpoints[k]["timestamp"])
        for k in oldest[:len(_checkpoints) - MAX_CHECKPOINTS]:
            del _checkpoints[k]


def restore_checkpoint(checkpoint_id: str) -> list[str]:
    """Restore files to their pre-agent state. Returns list of restored paths."""
    cp = _checkpoints.get(checkpoint_id)
    if not cp:
        raise ValueError(f"Checkpoint {checkpoint_id} not found")

    restored = []
    for path, original_content in cp["files"].items():
        full = os.path.normpath(os.path.join(WORKSPACE_DIR, path))
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


def get_checkpoint(checkpoint_id: str) -> Optional[dict]:
    return _checkpoints.get(checkpoint_id)


def read_file_for_checkpoint(path: str) -> Optional[str]:
    """Read current file content for checkpoint (returns None if file doesn't exist)."""
    full = os.path.normpath(os.path.join(WORKSPACE_DIR, path))
    if not os.path.isfile(full):
        return None
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception:
        return None
