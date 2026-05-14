"""
File/image upload handling for chat context.
"""
from __future__ import annotations

import base64
import json
import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "tmp", "chat_uploads")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_LINES_TEXT = 200

ALLOWED_TEXT_EXTS = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".html", ".css", ".json",
    ".md", ".txt", ".yaml", ".yml", ".toml", ".env", ".sh", ".rs",
    ".go", ".java", ".cpp", ".c", ".h", ".rb", ".php", ".sql",
    ".xml", ".csv", ".ini", ".cfg", ".conf", ".dockerfile", ".gitignore",
}

ALLOWED_IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}


def _session_dir(session_id: str, workspace_dir: str | None = None, user_id: str | None = None) -> str:
    base_dir = os.path.join(workspace_dir, ".coide_uploads") if workspace_dir else UPLOAD_DIR
    if user_id:
        base_dir = os.path.join(base_dir, user_id)
    session_dir = os.path.join(base_dir, session_id)
    os.makedirs(session_dir, exist_ok=True)
    return session_dir


def _manifest_path(session_dir: str) -> str:
    return os.path.join(session_dir, "manifest.json")


def _load_manifest(session_dir: str) -> dict:
    mpath = _manifest_path(session_dir)
    if not os.path.isfile(mpath):
        return {"files": []}
    try:
        with open(mpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and isinstance(data.get("files"), list):
            return data
    except Exception:
        pass
    return {"files": []}


def _save_manifest(session_dir: str, manifest: dict):
    mpath = _manifest_path(session_dir)
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def list_uploads(session_id: str, workspace_dir: str | None = None, user_id: str | None = None) -> list[dict]:
    session_dir = _session_dir(session_id, workspace_dir=workspace_dir, user_id=user_id)
    manifest = _load_manifest(session_dir)
    return manifest["files"]


def get_upload(upload_id: str, session_id: str, workspace_dir: str | None = None, user_id: str | None = None) -> dict | None:
    files = list_uploads(session_id, workspace_dir=workspace_dir, user_id=user_id)
    return next((f for f in files if f.get("id") == upload_id), None)


def load_recent_images(
    session_id: str,
    workspace_dir: str | None = None,
    user_id: str | None = None,
    limit: int = 3,
) -> list[dict]:
    images = [f for f in list_uploads(session_id, workspace_dir=workspace_dir, user_id=user_id) if f.get("type") == "image"]
    if not images:
        return []
    selected = images[-limit:]
    hydrated = []
    for item in selected:
        path = item.get("storage_path")
        if not path or not os.path.isfile(path):
            continue
        try:
            with open(path, "rb") as f:
                content = f.read()
            hydrated.append({
                "id": item.get("id"),
                "filename": item.get("filename"),
                "type": "image",
                "media_type": item.get("media_type") or "image/png",
                "base64": base64.b64encode(content).decode("ascii"),
                "size": item.get("size"),
                "storage_path": path,
            })
        except Exception:
            continue
    return hydrated


async def process_upload(file: UploadFile, session_id: str, workspace_dir: str | None = None, user_id: str | None = None) -> dict:
    """Process an uploaded file. Returns metadata + content."""
    content = await file.read()
    size = len(content)

    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large: {size // 1024 // 1024}MB (max 10MB)")

    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    file_id = str(uuid.uuid4())[:8]

    session_dir = _session_dir(session_id, workspace_dir=workspace_dir, user_id=user_id)
    save_path = os.path.join(session_dir, f"{file_id}_{filename}")
    with open(save_path, "wb") as f:
        f.write(content)

    manifest = _load_manifest(session_dir)

    meta = {
        "id": file_id,
        "filename": filename,
        "type": "binary",
        "size": size,
        "session_id": session_id,
        "storage_path": save_path,
    }

    if ext in ALLOWED_IMAGE_EXTS:
        # Encode as base64 for vision models
        b64 = base64.b64encode(content).decode("ascii")
        media_type = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".svg": "image/svg+xml",
        }.get(ext, "image/png")
        meta.update({
            "type": "image",
            "media_type": media_type,
            "base64": b64,
        })
        manifest["files"] = [f for f in manifest["files"] if f.get("id") != file_id]
        manifest["files"].append({
            "id": file_id,
            "filename": filename,
            "type": "image",
            "media_type": media_type,
            "size": size,
            "storage_path": save_path,
        })
        _save_manifest(session_dir, manifest)
        return meta

    elif ext in ALLOWED_TEXT_EXTS:
        try:
            text = content.decode("utf-8", errors="replace")
            lines = text.splitlines()
            truncated = len(lines) > MAX_LINES_TEXT
            if truncated:
                text = "\n".join(lines[:MAX_LINES_TEXT]) + f"\n... ({len(lines) - MAX_LINES_TEXT} more lines, truncated)"
            meta.update({
                "type": "text",
                "content": text,
                "truncated": truncated,
                "line_count": len(lines),
            })
            manifest["files"] = [f for f in manifest["files"] if f.get("id") != file_id]
            manifest["files"].append({
                "id": file_id,
                "filename": filename,
                "type": "text",
                "size": size,
                "line_count": len(lines),
                "storage_path": save_path,
            })
            _save_manifest(session_dir, manifest)
            return meta
        except Exception as e:
            meta.update({
                "type": "error",
                "content": f"Could not read file: {e}",
            })
            manifest["files"] = [f for f in manifest["files"] if f.get("id") != file_id]
            manifest["files"].append({
                "id": file_id,
                "filename": filename,
                "type": "error",
                "size": size,
                "storage_path": save_path,
            })
            _save_manifest(session_dir, manifest)
            return meta
    else:
        meta.update({
            "content": f"Binary file ({size // 1024}KB) — cannot attach as text",
        })
        manifest["files"] = [f for f in manifest["files"] if f.get("id") != file_id]
        manifest["files"].append({
            "id": file_id,
            "filename": filename,
            "type": "binary",
            "size": size,
            "storage_path": save_path,
        })
        _save_manifest(session_dir, manifest)
        return meta
