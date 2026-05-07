"""
Chat API router. Mounted at /chat in main.py.
"""
from __future__ import annotations

import asyncio
import json
import os
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from fastapi.responses import StreamingResponse

from .agent import run_agent
from .memory import restore_checkpoint, get_checkpoint
from .uploads import process_upload

router = APIRouter(prefix="/chat", tags=["chat"])

# Active abort events: thread_id → asyncio.Event
_abort_events: dict[str, asyncio.Event] = {}


@router.post("/message")
async def chat_message(request: Request):
    """
    Main chat endpoint. Returns NDJSON stream.
    Each line is a JSON object with a 'type' field.
    """
    body = await request.json()

    thread_id = body.get("thread_id", "default")
    messages = body.get("messages", [])
    context = body.get("context", {})
    model_config = body.get("model_config", {})
    mode = body.get("mode", "auto")
    settings = body.get("settings", {})

    # Cancel any existing stream for this thread
    if thread_id in _abort_events:
        _abort_events[thread_id].set()
    abort_event = asyncio.Event()
    _abort_events[thread_id] = abort_event

    async def generate():
        try:
            async for chunk in run_agent(
                messages=messages,
                context=context,
                model_config=model_config,
                mode=mode,
                settings=settings,
                abort_event=abort_event,
            ):
                if abort_event.is_set():
                    break
                yield chunk
        except Exception as e:
            yield json.dumps({"type": "error", "message": f"Server error: {str(e)}"}) + "\n"
        finally:
            if _abort_events.get(thread_id) is abort_event:
                del _abort_events[thread_id]

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@router.post("/abort/{thread_id}")
async def abort_chat(thread_id: str):
    """Cancel an in-progress chat stream."""
    if thread_id in _abort_events:
        _abort_events[thread_id].set()
        return {"status": "aborted"}
    return {"status": "not_running"}


@router.post("/upload")
async def upload_files(
    request: Request,
    files: list[UploadFile] = File(...),
):
    """Upload files for chat context."""
    session_id = request.headers.get("X-Session-Id", "default")
    if len(files) > 10:
        raise HTTPException(status_code=400, detail="Max 10 files per upload")

    results = []
    for file in files:
        result = await process_upload(file, session_id)
        results.append(result)

    return {"files": results}


@router.post("/checkpoint/{checkpoint_id}/restore")
async def restore_checkpoint_endpoint(checkpoint_id: str):
    """Restore files to pre-agent state."""
    try:
        restored = restore_checkpoint(checkpoint_id)
        return {"status": "ok", "restored_files": restored}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Restore failed: {e}")


@router.get("/checkpoint/{checkpoint_id}")
async def get_checkpoint_info(checkpoint_id: str):
    """Get checkpoint metadata."""
    cp = get_checkpoint(checkpoint_id)
    if not cp:
        raise HTTPException(status_code=404, detail="Checkpoint not found")
    return {
        "id": cp["id"],
        "timestamp": cp["timestamp"],
        "files": list(cp["files"].keys()),
    }
