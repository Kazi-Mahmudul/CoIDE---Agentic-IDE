"""
Full agentic loop with streaming NDJSON output.
Supports both CHAT mode (single LLM call) and AGENT mode (tool loop).
"""
from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from typing import AsyncGenerator, Optional

import httpx

from .classifier import classify
from .context import build_system_prompt
from .memory import save_checkpoint, read_file_for_checkpoint
from .tools import TOOL_SCHEMAS, execute_tool

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import WORKSPACE_DIR


def _emit(obj: dict) -> str:
    return json.dumps(obj) + "\n"


def _image_to_content_part(image: dict) -> dict | None:
    media_type = image.get("media_type") or "image/png"
    if image.get("base64"):
        return {
            "type": "image_url",
            "image_url": {
                "url": f"data:{media_type};base64,{image['base64']}",
            },
        }
    url = image.get("url")
    if url:
        return {"type": "image_url", "image_url": {"url": url}}
    return None


def _message_with_images(msg: dict, images: list[dict]) -> dict:
    patched = dict(msg)
    existing_content = patched.get("content", "") or ""
    if isinstance(existing_content, list):
        text_parts = [p.get("text", "") for p in existing_content if isinstance(p, dict) and p.get("type") == "text"]
        text = "\n".join([t for t in text_parts if t])
    else:
        text = str(existing_content)
    content_parts = [{"type": "text", "text": text}]
    for image in images[:6]:
        part = _image_to_content_part(image)
        if part:
            content_parts.append(part)
    patched["content"] = content_parts
    return patched


def _normalize_messages_with_images(messages: list[dict], attached_images: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for msg in messages:
        role = msg.get("role")
        if role == "user" and isinstance(msg.get("images"), list) and msg.get("images"):
            normalized.append(_message_with_images(msg, msg.get("images") or []))
        else:
            normalized.append(msg)

    if not normalized or not attached_images:
        return normalized

    # Also ensure current request-level attached images are appended to latest user message.
    for i in range(len(normalized) - 1, -1, -1):
        if normalized[i].get("role") == "user":
            normalized[i] = _message_with_images(normalized[i], attached_images)
            break
    return normalized


async def run_agent(
    messages: list[dict],
    context: dict,
    model_config: dict,
    mode: str = "auto",
    settings: dict = None,
    abort_event: Optional[asyncio.Event] = None,
    workspace_dir: str = WORKSPACE_DIR,
) -> AsyncGenerator[str, None]:
    """
    Main agentic loop. Yields NDJSON lines.
    """
    settings = settings or {}
    brain_mode = bool(settings.get("brain_mode"))
    web_search_enabled = bool(settings.get("web_search_enabled"))
    max_iterations = settings.get("max_iterations", 20)
    if brain_mode:
        max_iterations = max(max_iterations, 35)
    auto_apply = settings.get("auto_apply", False)

    base_url = model_config.get("base_url", "").rstrip("/")
    model = model_config.get("model", "")
    api_key = model_config.get("api_key", "")
    max_tokens = model_config.get("max_tokens", 4096)
    temperature = model_config.get("temperature", None)

    if not base_url or not model:
        yield _emit({"type": "error", "message": "Model not configured. Click the model badge to configure."})
        return

    # Detect mode
    last_user = next((m["content"] for m in reversed(messages) if m["role"] == "user"), "")
    detected_mode = classify(last_user, mode)
    if web_search_enabled and detected_mode == "chat":
        detected_mode = "agent"
    yield _emit({"type": "mode", "mode": detected_mode})

    # Build system prompt
    system_content = build_system_prompt(
        mode=detected_mode,
        workspace_dir=workspace_dir,
        active_file=context.get("active_file"),
        active_file_content=context.get("active_file_content"),
        selection=context.get("selection"),
        diagnostics=context.get("diagnostics"),
        git_branch=context.get("git_branch"),
        codebase_summary=context.get("codebase_summary"),
        attached_files=context.get("attached_files"),
        attached_images=context.get("attached_images"),
        terminal_output=context.get("terminal_output"),
        brain_mode=brain_mode,
        web_search_enabled=web_search_enabled,
    )

    # Build message list
    llm_messages = [{"role": "system", "content": system_content}]
    attached_images = context.get("attached_images", []) or []
    normalized_messages = _normalize_messages_with_images(messages, attached_images)
    llm_messages.extend(normalized_messages)

    if brain_mode:
        plan = [
            "Understand request and constraints",
            "Inspect relevant files and state",
            "Design a minimal safe implementation plan",
            "Execute changes step by step",
            "Verify with tests/commands and summarize results",
        ]
        yield _emit({"type": "thinking", "content": "Plan:\n" + "\n".join(f"{i+1}. {s}" for i, s in enumerate(plan))})
        llm_messages.append({
            "role": "system",
            "content": (
                "Brain mode is enabled. Use explicit planning and verification. "
                "Prefer multi-step execution with clear intermediate checks."
            ),
        })
    if web_search_enabled:
        llm_messages.append({
            "role": "system",
            "content": (
                "Web search mode is enabled. Use web_search and fetch_url tools when external facts, "
                "libraries, docs, or current references are needed."
            ),
        })

    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    # Track files modified for checkpoint
    modified_files: dict[str, Optional[str]] = {}
    checkpoint_id = f"cp_{uuid.uuid4().hex[:8]}"

    async with httpx.AsyncClient(timeout=120.0) as client:
        if detected_mode == "chat":
            # ── CHAT MODE: single call, no tools ──────────────────────────
            payload = {
                "model": model,
                "messages": llm_messages,
                "stream": False,
                "max_tokens": max_tokens,
            }
            if temperature is not None:
                payload["temperature"] = temperature

            try:
                resp = await client.post(
                    f"{base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                if resp.status_code != 200:
                    yield _emit({"type": "error", "message": f"API error {resp.status_code}: {resp.text[:200]}"})
                    return

                data = resp.json()
                full_text = data.get("choices", [{}])[0].get("message", {}).get("content", "") or ""
                if full_text:
                    chunk_size = 40
                    for i in range(0, len(full_text), chunk_size):
                        if abort_event and abort_event.is_set():
                            break
                        yield _emit({"type": "text", "content": full_text[i:i + chunk_size]})
                        await asyncio.sleep(0)

                # Follow-up suggestions
                suggestions = _generate_suggestions(full_text, last_user)
                if suggestions:
                    yield _emit({"type": "suggestions", "items": suggestions})

                tokens = data.get("usage", {}).get("total_tokens")
                if not tokens:
                    tokens = len(full_text) // 4 * 4  # rough estimate
                yield _emit({"type": "done", "tokens_used": tokens})

            except httpx.TimeoutException:
                yield _emit({"type": "error", "message": "Request timed out. Try a shorter message or faster model."})
            except Exception as e:
                yield _emit({"type": "error", "message": f"Request failed: {str(e)}"})

        else:
            # ── AGENT MODE: tool loop ──────────────────────────────────────
            iteration = 0
            agent_messages = list(llm_messages)
            total_tokens = 0

            while iteration < max_iterations:
                if abort_event and abort_event.is_set():
                    yield _emit({"type": "error", "message": "Cancelled."})
                    return

                iteration += 1
                payload = {
                    "model": model,
                    "messages": agent_messages,
                    "tools": TOOL_SCHEMAS,
                    "tool_choice": "auto",
                    "max_tokens": max_tokens,
                }
                if temperature is not None:
                    payload["temperature"] = temperature

                try:
                    resp = await client.post(
                        f"{base_url}/chat/completions",
                        headers=headers, json=payload
                    )
                    if resp.status_code != 200:
                        yield _emit({"type": "error", "message": f"API error {resp.status_code}: {resp.text[:200]}"})
                        return

                    data = resp.json()
                    choice = data["choices"][0]
                    message = choice["message"]
                    tool_calls = message.get("tool_calls", [])
                    content = message.get("content") or ""
                    total_tokens += data.get("usage", {}).get("total_tokens", len(content) // 4)

                    # Stream any text content
                    if content:
                        # Check for <thinking> blocks
                        import re
                        thinking_match = re.search(r'<thinking>(.*?)</thinking>', content, re.DOTALL)
                        if thinking_match:
                            thinking_text = thinking_match.group(1).strip()
                            yield _emit({"type": "thinking", "content": thinking_text})
                            content = re.sub(r'<thinking>.*?</thinking>', '', content, flags=re.DOTALL).strip()

                        if content:
                            # Stream in chunks for smooth UX
                            chunk_size = 30
                            for i in range(0, len(content), chunk_size):
                                yield _emit({"type": "text", "content": content[i:i+chunk_size]})
                                await asyncio.sleep(0)

                    if not tool_calls:
                        # No more tool calls — done
                        break

                    # Execute tool calls
                    agent_messages.append(message)

                    for tc in tool_calls:
                        if abort_event and abort_event.is_set():
                            yield _emit({"type": "error", "message": "Cancelled."})
                            return

                        func = tc.get("function", {})
                        tool_name = func.get("name", "unknown")
                        tool_id = tc.get("id", str(uuid.uuid4()))

                        try:
                            tool_args = json.loads(func.get("arguments", "{}"))
                        except json.JSONDecodeError:
                            tool_args = {}

                        # Emit tool start
                        yield _emit({
                            "type": "tool_start",
                            "id": tool_id,
                            "name": tool_name,
                            "args": tool_args,
                        })

                        # Snapshot file before modification for checkpoint
                        if tool_name in ("write_file", "edit_file", "create_file", "delete_file", "rename_file"):
                            path = tool_args.get("path") or tool_args.get("old_path", "")
                            if path and path not in modified_files:
                                modified_files[path] = read_file_for_checkpoint(path, workspace_dir)

                        # Execute
                        t0 = time.monotonic()
                        result = await execute_tool(tool_name, tool_args, workspace_dir=workspace_dir)
                        duration_ms = int((time.monotonic() - t0) * 1000)

                        # Emit tool output
                        yield _emit({
                            "type": "tool_output",
                            "id": tool_id,
                            "name": tool_name,
                            "output": result,
                            "duration_ms": duration_ms,
                        })

                        # If file was written, emit diff event
                        if tool_name in ("write_file", "edit_file") and "Error" not in result:
                            path = tool_args.get("path", "")
                            new_content = tool_args.get("content") or tool_args.get("new_str", "")
                            old_content = modified_files.get(path)
                            if path and new_content is not None:
                                yield _emit({
                                    "type": "diff",
                                    "path": path,
                                    "old": old_content or "",
                                    "new": new_content,
                                })

                        agent_messages.append({
                            "role": "tool",
                            "tool_call_id": tool_id,
                            "content": result,
                        })

                except httpx.TimeoutException:
                    yield _emit({"type": "error", "message": "Request timed out."})
                    return
                except Exception as e:
                    yield _emit({"type": "error", "message": f"Error: {str(e)}"})
                    return

            # Save checkpoint if files were modified
            if modified_files:
                save_checkpoint(checkpoint_id, context.get("user_id", "unknown"), modified_files)
                yield _emit({
                    "type": "checkpoint",
                    "id": checkpoint_id,
                    "files_changed": list(modified_files.keys()),
                })

            # Follow-up suggestions
            last_text = ""
            for m in reversed(agent_messages):
                if m.get("role") == "assistant" and m.get("content"):
                    last_text = m["content"]
                    break
            suggestions = _generate_suggestions(last_text, last_user)
            if suggestions:
                yield _emit({"type": "suggestions", "items": suggestions})

            if iteration >= max_iterations:
                yield _emit({"type": "error", "message": f"Reached max iterations ({max_iterations}). Task may be incomplete."})

            yield _emit({"type": "done", "tokens_used": total_tokens})


def _generate_suggestions(response_text: str, user_query: str) -> list[str]:
    """Generate 2-3 follow-up suggestions based on response."""
    suggestions = []
    text_lower = response_text.lower()
    query_lower = user_query.lower()

    if "test" not in query_lower and ("function" in text_lower or "class" in text_lower or "def " in text_lower):
        suggestions.append("Write tests for this")
    if "explain" not in query_lower and len(response_text) > 200:
        suggestions.append("Explain the changes")
    if any(w in text_lower for w in ["error", "bug", "fix", "issue"]):
        suggestions.append("Run the tests now")
    elif any(w in text_lower for w in ["created", "written", "added", "implemented"]):
        suggestions.append("Show me the file structure")
    if not suggestions:
        suggestions = ["What else should I improve?", "Add error handling", "Add documentation"]

    return suggestions[:3]
