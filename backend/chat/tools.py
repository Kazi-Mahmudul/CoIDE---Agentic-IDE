"""
Full tool suite for the agentic chat loop.
All tools operate within workspace/ (sandboxed).
"""
from __future__ import annotations

import asyncio
import fnmatch
import json
import os
import shutil
import subprocess
import time
import contextvars
from pathlib import Path
from typing import Optional

import sys
# Add parent directory to path so we can import config
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import WORKSPACE_DIR
from workspace import ensure_workspace_dir, resolve_workspace_path

SKIP_DIRS = {"node_modules", "__pycache__", ".git", "venv", ".venv", "dist", ".next", "build", ".cache"}
DANGEROUS_PATTERNS = ("rm -rf /", "del /f /s /q", "format ", "mkfs", ":(){:|:&};:", "shutdown", "reboot")
_workspace_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("workspace_dir", default=None)


def set_workspace_dir(workspace_dir: str):
    _workspace_var.set(ensure_workspace_dir(workspace_dir))


def get_workspace_dir() -> str:
    return _workspace_var.get() or ensure_workspace_dir(WORKSPACE_DIR)


def _safe(path: str) -> str:
    """Resolve path safely within workspace."""
    try:
        return resolve_workspace_path(get_workspace_dir(), path)
    except Exception:
        raise ValueError(f"Path traversal blocked: {path}")


# ── File tools ────────────────────────────────────────────────────────────────

async def read_file(path: str) -> str:
    safe = _safe(path)
    if not os.path.isfile(safe):
        return f"Error: File not found: {path}"
    try:
        with open(safe, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        lines = content.splitlines()
        return f"File: {path} ({len(lines)} lines)\n\n{content}"
    except Exception as e:
        return f"Error reading {path}: {e}"


async def write_file(path: str, content: str) -> str:
    safe = _safe(path)
    try:
        os.makedirs(os.path.dirname(safe) or get_workspace_dir(), exist_ok=True)
        with open(safe, "w", encoding="utf-8") as f:
            f.write(content)
        lines = content.splitlines()
        return f"Written: {path} ({len(lines)} lines)"
    except Exception as e:
        return f"Error writing {path}: {e}"


async def edit_file(path: str, old_str: str, new_str: str) -> str:
    """Find and replace a unique string in a file."""
    safe = _safe(path)
    if not os.path.isfile(safe):
        return f"Error: File not found: {path}"
    try:
        with open(safe, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        count = content.count(old_str)
        if count == 0:
            return f"Error: String not found in {path}. Make sure to copy the exact text."
        if count > 1:
            return f"Error: String found {count} times in {path}. Provide more context to make it unique."
        new_content = content.replace(old_str, new_str, 1)
        with open(safe, "w", encoding="utf-8") as f:
            f.write(new_content)
        return f"Edited: {path} (replaced 1 occurrence)"
    except Exception as e:
        return f"Error editing {path}: {e}"


async def create_file(path: str, content: str = "") -> str:
    safe = _safe(path)
    try:
        os.makedirs(os.path.dirname(safe) or get_workspace_dir(), exist_ok=True)
        if os.path.exists(safe):
            return f"File already exists: {path}"
        with open(safe, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Created: {path}"
    except Exception as e:
        return f"Error creating {path}: {e}"


async def delete_file(path: str) -> str:
    safe = _safe(path)
    try:
        if os.path.isfile(safe):
            os.remove(safe)
            return f"Deleted file: {path}"
        elif os.path.isdir(safe):
            shutil.rmtree(safe)
            return f"Deleted directory: {path}"
        return f"Not found: {path}"
    except Exception as e:
        return f"Error deleting {path}: {e}"


async def rename_file(old_path: str, new_path: str) -> str:
    old_safe = _safe(old_path)
    new_safe = _safe(new_path)
    try:
        os.makedirs(os.path.dirname(new_safe) or get_workspace_dir(), exist_ok=True)
        shutil.move(old_safe, new_safe)
        return f"Renamed: {old_path} → {new_path}"
    except Exception as e:
        return f"Error renaming: {e}"


async def list_files(path: str = ".") -> str:
    safe = _safe(path) if path and path != "." else get_workspace_dir()
    if not os.path.isdir(safe):
        return f"Error: Directory not found: {path}"
    lines = []
    def _walk(d: str, prefix: str = "", depth: int = 0):
        if depth > 3:
            return
        try:
            items = sorted(os.listdir(d))
        except PermissionError:
            return
        dirs = [i for i in items if os.path.isdir(os.path.join(d, i)) and i not in SKIP_DIRS and not i.startswith('.')]
        files = [i for i in items if os.path.isfile(os.path.join(d, i)) and not i.startswith('.')]
        for i, name in enumerate(dirs + files):
            is_last = i == len(dirs) + len(files) - 1
            connector = "└── " if is_last else "├── "
            full = os.path.join(d, name)
            lines.append(f"{prefix}{connector}{name}{'/' if os.path.isdir(full) else ''}")
            if os.path.isdir(full):
                ext = "    " if is_last else "│   "
                _walk(full, prefix + ext, depth + 1)
    rel = os.path.relpath(safe, get_workspace_dir())
    lines.append(f"{rel if rel != '.' else 'workspace'}/")
    _walk(safe)
    return "\n".join(lines)


async def search_files(query: str, path: str = ".", file_pattern: str = "*") -> str:
    safe = _safe(path) if path and path != "." else get_workspace_dir()
    results = []
    for root, dirs, files in os.walk(safe):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        for fname in files:
            if not fnmatch.fnmatch(fname, file_pattern):
                continue
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, get_workspace_dir())
            try:
                with open(fpath, "r", encoding="utf-8", errors="strict") as f:
                    for lineno, line in enumerate(f, 1):
                        if query.lower() in line.lower():
                            results.append(f"{rel}:{lineno}: {line.rstrip()}")
                            if len(results) >= 50:
                                return "\n".join(results) + "\n(truncated at 50 results)"
            except (UnicodeDecodeError, PermissionError, OSError):
                continue
    return "\n".join(results) if results else f"No matches for '{query}'"


async def glob_files(pattern: str) -> str:
    matches = []
    workspace_dir = get_workspace_dir()
    for p in Path(workspace_dir).rglob(pattern):
        rel = p.relative_to(workspace_dir)
        parts = rel.parts
        if any(part in SKIP_DIRS or part.startswith('.') for part in parts):
            continue
        matches.append(str(rel).replace("\\", "/"))
    return "\n".join(sorted(matches)) if matches else f"No files matching '{pattern}'"


async def read_multiple_files(paths: list) -> str:
    parts = []
    for path in paths[:10]:  # max 10
        safe = _safe(path)
        if not os.path.isfile(safe):
            parts.append(f"=== {path} ===\nFile not found\n")
            continue
        try:
            with open(safe, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()
            parts.append(f"=== {path} ===\n{content}\n")
        except Exception as e:
            parts.append(f"=== {path} ===\nError: {e}\n")
    return "\n".join(parts)


# ── Terminal tools ────────────────────────────────────────────────────────────

async def run_command(command: str, timeout: int = 30) -> str:
    lowered = command.lower()
    if any(p in lowered for p in DANGEROUS_PATTERNS):
        return "Error: Command blocked for safety."
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=get_workspace_dir(),
        )
        try:
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        except asyncio.TimeoutError:
            proc.kill()
            return f"Error: Command timed out after {timeout}s"
        output = stdout.decode("utf-8", errors="replace").strip()
        rc = proc.returncode
        if rc != 0:
            return f"Exit code {rc}:\n{output}" if output else f"Exit code {rc} (no output)"
        return output or "(no output)"
    except Exception as e:
        return f"Error running command: {e}"


# ── Code intelligence tools ───────────────────────────────────────────────────

async def get_file_outline(path: str) -> str:
    """Get a structural outline of a file (functions, classes, etc.)."""
    safe = _safe(path)
    if not os.path.isfile(safe):
        return f"Error: File not found: {path}"
    try:
        with open(safe, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except Exception as e:
        return f"Error reading {path}: {e}"

    outline = []
    import re
    patterns = [
        (re.compile(r'^(class\s+\w+)', re.M), "class"),
        (re.compile(r'^(def\s+\w+|async\s+def\s+\w+)', re.M), "function"),
        (re.compile(r'^(function\s+\w+|const\s+\w+\s*=\s*(?:async\s*)?\(|export\s+(?:default\s+)?(?:function|class)\s+\w+)', re.M), "js"),
    ]
    for i, line in enumerate(lines, 1):
        stripped = line.strip()
        for pat, kind in patterns:
            if pat.match(stripped):
                outline.append(f"  {i:4d}: {stripped[:80]}")
                break
    return f"Outline of {path}:\n" + ("\n".join(outline) if outline else "  (no symbols found)")


async def get_codebase_summary() -> str:
    """Return a summary of the workspace: file count, tech stack, structure."""
    file_count = 0
    tech = set()
    top_level = []

    try:
        workspace_dir = get_workspace_dir()
        top_level = [
            f for f in sorted(os.listdir(workspace_dir))
            if not f.startswith('.') and f not in SKIP_DIRS
        ]
    except Exception:
        pass

    for root, dirs, files in os.walk(get_workspace_dir()):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith('.')]
        file_count += len([f for f in files if not f.startswith('.')])
        for f in files:
            if f == "package.json": tech.add("Node.js/JavaScript")
            elif f == "requirements.txt" or f == "pyproject.toml": tech.add("Python")
            elif f == "Cargo.toml": tech.add("Rust")
            elif f == "go.mod": tech.add("Go")
            elif f == "pom.xml": tech.add("Java/Maven")
            elif f == "Gemfile": tech.add("Ruby")
            elif f.endswith(".ts") or f.endswith(".tsx"): tech.add("TypeScript")
            elif f.endswith(".jsx"): tech.add("React")

    lines = [
        f"Workspace: {get_workspace_dir()}",
        f"Files: {file_count}",
        f"Tech stack: {', '.join(sorted(tech)) or 'unknown'}",
        f"Top-level: {', '.join(top_level[:20])}",
    ]

    # README summary
    for readme in ["README.md", "readme.md", "README.txt"]:
        rpath = os.path.join(get_workspace_dir(), readme)
        if os.path.isfile(rpath):
            try:
                with open(rpath, "r", encoding="utf-8", errors="replace") as f:
                    first = f.read(500)
                lines.append(f"\nREADME preview:\n{first}")
            except Exception:
                pass
            break

    return "\n".join(lines)


# ── Git tools ─────────────────────────────────────────────────────────────────

async def git_status() -> str:
    return await run_command("git status")


async def git_diff(path: Optional[str] = None) -> str:
    cmd = f"git diff {path}" if path else "git diff"
    return await run_command(cmd)


async def git_log(n: int = 10) -> str:
    return await run_command(f"git log --oneline -n {n}")


async def git_commit(message: str) -> str:
    result = await run_command(f'git add -A && git commit -m "{message}"')
    return result


async def git_create_branch(name: str) -> str:
    return await run_command(f"git checkout -b {name}")


# ── Web tools ─────────────────────────────────────────────────────────────────

async def web_search(query: str) -> str:
    api_key = os.environ.get("SEARCH_API_KEY", "")
    if not api_key:
        return "Web search not configured. Set SEARCH_API_KEY environment variable."
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": 5},
                headers={"Accept": "application/json", "X-Subscription-Token": api_key},
            )
            if resp.status_code != 200:
                return f"Search failed: {resp.status_code}"
            data = resp.json()
            results = data.get("web", {}).get("results", [])
            lines = []
            for r in results[:5]:
                lines.append(f"**{r.get('title')}**\n{r.get('url')}\n{r.get('description', '')}\n")
            return "\n".join(lines) if lines else "No results found."
    except Exception as e:
        return f"Search error: {e}"


async def fetch_url(url: str) -> str:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "Coide-IDE/1.0"})
            text = resp.text[:10000]
            # Basic HTML → text stripping
            import re
            text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()
            return text[:5000]
    except Exception as e:
        return f"Error fetching {url}: {e}"


# ── Tool registry ─────────────────────────────────────────────────────────────

TOOL_EXECUTORS = {
    "read_file": read_file,
    "write_file": write_file,
    "edit_file": edit_file,
    "create_file": create_file,
    "delete_file": delete_file,
    "rename_file": rename_file,
    "list_files": list_files,
    "search_files": search_files,
    "glob_files": glob_files,
    "read_multiple_files": read_multiple_files,
    "run_command": run_command,
    "get_file_outline": get_file_outline,
    "get_codebase_summary": get_codebase_summary,
    "git_status": git_status,
    "git_diff": git_diff,
    "git_log": git_log,
    "git_commit": git_commit,
    "git_create_branch": git_create_branch,
    "web_search": web_search,
    "fetch_url": fetch_url,
}

TOOL_SCHEMAS = [
    {"type": "function", "function": {"name": "read_file", "description": "Read a file's content from the workspace.", "parameters": {"type": "object", "properties": {"path": {"type": "string", "description": "Relative path from workspace root"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "write_file", "description": "Write content to a file (creates or overwrites). Creates parent directories.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string", "description": "Full file content to write"}}, "required": ["path", "content"]}}},
    {"type": "function", "function": {"name": "edit_file", "description": "Find and replace a unique string in a file. Fails if string not found or found multiple times.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "old_str": {"type": "string", "description": "Exact string to find (must be unique in file)"}, "new_str": {"type": "string", "description": "Replacement string"}}, "required": ["path", "old_str", "new_str"]}}},
    {"type": "function", "function": {"name": "create_file", "description": "Create a new file with optional content.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}, "content": {"type": "string", "default": ""}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "delete_file", "description": "Delete a file or directory.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "rename_file", "description": "Rename or move a file.", "parameters": {"type": "object", "properties": {"old_path": {"type": "string"}, "new_path": {"type": "string"}}, "required": ["old_path", "new_path"]}}},
    {"type": "function", "function": {"name": "list_files", "description": "List files in a directory as a tree (depth 3).", "parameters": {"type": "object", "properties": {"path": {"type": "string", "default": "."}}, "required": []}}},
    {"type": "function", "function": {"name": "search_files", "description": "Search file contents (grep-style). Returns file:line:content matches.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}, "path": {"type": "string", "default": "."}, "file_pattern": {"type": "string", "default": "*", "description": "Glob pattern like *.py"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "glob_files", "description": "Find files matching a glob pattern.", "parameters": {"type": "object", "properties": {"pattern": {"type": "string", "description": "Glob pattern like **/*.py"}}, "required": ["pattern"]}}},
    {"type": "function", "function": {"name": "read_multiple_files", "description": "Read multiple files at once.", "parameters": {"type": "object", "properties": {"paths": {"type": "array", "items": {"type": "string"}}}, "required": ["paths"]}}},
    {"type": "function", "function": {"name": "run_command", "description": "Run a shell command in the workspace directory. Returns stdout+stderr.", "parameters": {"type": "object", "properties": {"command": {"type": "string"}, "timeout": {"type": "integer", "default": 30}}, "required": ["command"]}}},
    {"type": "function", "function": {"name": "get_file_outline", "description": "Get structural outline of a file (functions, classes).", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": ["path"]}}},
    {"type": "function", "function": {"name": "get_codebase_summary", "description": "Get workspace summary: file count, tech stack, structure.", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "git_status", "description": "Run git status.", "parameters": {"type": "object", "properties": {}, "required": []}}},
    {"type": "function", "function": {"name": "git_diff", "description": "Run git diff.", "parameters": {"type": "object", "properties": {"path": {"type": "string"}}, "required": []}}},
    {"type": "function", "function": {"name": "git_log", "description": "Get last N git commits.", "parameters": {"type": "object", "properties": {"n": {"type": "integer", "default": 10}}, "required": []}}},
    {"type": "function", "function": {"name": "git_commit", "description": "Stage all changes and commit.", "parameters": {"type": "object", "properties": {"message": {"type": "string"}}, "required": ["message"]}}},
    {"type": "function", "function": {"name": "git_create_branch", "description": "Create and checkout a new git branch.", "parameters": {"type": "object", "properties": {"name": {"type": "string"}}, "required": ["name"]}}},
    {"type": "function", "function": {"name": "web_search", "description": "Search the web. Requires SEARCH_API_KEY env var.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}}},
    {"type": "function", "function": {"name": "fetch_url", "description": "Fetch URL content as text.", "parameters": {"type": "object", "properties": {"url": {"type": "string"}}, "required": ["url"]}}},
]


async def execute_tool(name: str, arguments: dict, workspace_dir: str | None = None) -> str:
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return f"Unknown tool: {name}"
    token = None
    try:
        if workspace_dir:
            token = _workspace_var.set(ensure_workspace_dir(workspace_dir))
        return await executor(**arguments)
    except TypeError as e:
        return f"Tool error ({name}): invalid arguments: {e}"
    except Exception as e:
        return f"Tool error ({name}): {e}"
    finally:
        if token is not None:
            _workspace_var.reset(token)
