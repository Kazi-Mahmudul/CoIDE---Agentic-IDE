"""
File/image upload handling for chat context.
"""
from __future__ import annotations

import base64
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


async def process_upload(file: UploadFile, session_id: str) -> dict:
    """Process an uploaded file. Returns metadata + content."""
    content = await file.read()
    size = len(content)

    if size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"File too large: {size // 1024 // 1024}MB (max 10MB)")

    filename = file.filename or "unknown"
    ext = Path(filename).suffix.lower()
    file_id = str(uuid.uuid4())[:8]

    # Save to temp dir
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)
    save_path = os.path.join(session_dir, f"{file_id}_{filename}")
    with open(save_path, "wb") as f:
        f.write(content)

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
        return {
            "id": file_id,
            "filename": filename,
            "type": "image",
            "media_type": media_type,
            "base64": b64,
            "size": size,
        }

    elif ext in ALLOWED_TEXT_EXTS:
        try:
            text = content.decode("utf-8", errors="replace")
            lines = text.splitlines()
            truncated = len(lines) > MAX_LINES_TEXT
            if truncated:
                text = "\n".join(lines[:MAX_LINES_TEXT]) + f"\n... ({len(lines) - MAX_LINES_TEXT} more lines, truncated)"
            return {
                "id": file_id,
                "filename": filename,
                "type": "text",
                "content": text,
                "size": size,
                "truncated": truncated,
                "line_count": len(lines),
            }
        except Exception as e:
            return {
                "id": file_id,
                "filename": filename,
                "type": "error",
                "content": f"Could not read file: {e}",
                "size": size,
            }
    else:
        return {
            "id": file_id,
            "filename": filename,
            "type": "binary",
            "content": f"Binary file ({size // 1024}KB) — cannot attach as text",
            "size": size,
        }
