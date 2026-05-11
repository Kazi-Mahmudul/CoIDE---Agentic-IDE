"""
Tool definitions and executors for the agentic IDE.
Each tool operates within the workspace/ directory.
"""

import os
import json
import asyncio
import shutil
from pathlib import Path

from config import WORKSPACE_DIR


def _safe_path(path: str) -> str:
    """Sanitize and resolve a path to ensure it stays within workspace/."""
    # Normalize the path and resolve any .. or . components
    if path.startswith("workspace/") or path.startswith("workspace\\"):
        path = path[len("workspace/"):] if path.startswith("workspace/") else path[len("workspace\\"):]
    
    resolved = os.path.normpath(os.path.join(WORKSPACE_DIR, path))
    if not resolved.startswith(os.path.normpath(WORKSPACE_DIR)):
        raise ValueError(f"Path traversal detected: {path}")
    return resolved


# ──────────────────────────── Tool Functions ────────────────────────────

async def read_file(path: str) -> str:
    """Read the contents of a file."""
    safe = _safe_path(path)
    if not os.path.isfile(safe):
        return f"Error: File not found: {path}"
    try:
        with open(safe, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"


async def write_file(path: str, content: str) -> str:
    """Write content to a file, creating directories as needed."""
    safe = _safe_path(path)
    try:
        os.makedirs(os.path.dirname(safe), exist_ok=True)
        with open(safe, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {e}"


async def list_files(path: str = "") -> str:
    """List files and directories recursively."""
    safe = _safe_path(path) if path else WORKSPACE_DIR
    if not os.path.isdir(safe):
        return f"Error: Directory not found: {path}"
    
    result = []
    for root, dirs, files in os.walk(safe):
        # Skip hidden dirs and common large dirs
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', '.git', 'venv')]
        level = root.replace(safe, '').count(os.sep)
        indent = '  ' * level
        rel = os.path.relpath(root, WORKSPACE_DIR)
        if rel == '.':
            rel = 'workspace/'
        else:
            rel = f"workspace/{rel}/"
        result.append(f"{indent}{os.path.basename(root)}/")
        sub_indent = '  ' * (level + 1)
        for file in files:
            if not file.startswith('.'):
                result.append(f"{sub_indent}{file}")
    return '\n'.join(result) if result else "Empty directory"


async def run_command(command: str) -> str:
    """Run a shell command in the workspace directory."""
    try:
        proc = await asyncio.create_subprocess_shell(
            command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=WORKSPACE_DIR
        )
        try:
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
        except asyncio.TimeoutError:
            proc.kill()
            return "Error: Command timed out after 30 seconds"
        
        output = ""
        if stdout:
            output += stdout.decode("utf-8", errors="replace")
        if stderr:
            output += "\n" + stderr.decode("utf-8", errors="replace")
        return output.strip() or "(no output)"
    except Exception as e:
        return f"Error running command: {e}"


async def search_code(query: str, path: str = "") -> str:
    """Search for a string pattern in files (grep-style)."""
    safe = _safe_path(path) if path else WORKSPACE_DIR
    if not os.path.isdir(safe):
        return f"Error: Directory not found: {path}"
    
    results = []
    max_results = 50
    count = 0
    
    for root, dirs, files in os.walk(safe):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '__pycache__', '.git', 'venv')]
        for fname in files:
            if count >= max_results:
                break
            fpath = os.path.join(root, fname)
            # Skip binary files
            try:
                with open(fpath, "r", encoding="utf-8", errors="strict") as f:
                    for line_no, line in enumerate(f, 1):
                        if query.lower() in line.lower():
                            rel = os.path.relpath(fpath, WORKSPACE_DIR)
                            results.append(f"{rel}:{line_no}: {line.rstrip()}")
                            count += 1
                            if count >= max_results:
                                break
            except (UnicodeDecodeError, PermissionError, OSError):
                continue
    
    if not results:
        return f"No matches found for '{query}'"
    return '\n'.join(results)


async def create_file(path: str) -> str:
    """Create a new empty file, creating directories as needed."""
    safe = _safe_path(path)
    try:
        os.makedirs(os.path.dirname(safe), exist_ok=True)
        if not os.path.exists(safe):
            with open(safe, "w") as f:
                pass
            return f"Created file: {path}"
        else:
            return f"File already exists: {path}"
    except Exception as e:
        return f"Error creating file: {e}"


async def delete_file(path: str) -> str:
    """Delete a file or directory."""
    safe = _safe_path(path)
    try:
        if os.path.isfile(safe):
            os.remove(safe)
            return f"Deleted file: {path}"
        elif os.path.isdir(safe):
            shutil.rmtree(safe)
            return f"Deleted directory: {path}"
        else:
            return f"Not found: {path}"
    except Exception as e:
        return f"Error deleting: {e}"


# ──────────────────────────── Tool Registry ────────────────────────────

TOOL_EXECUTORS = {
    "read_file": read_file,
    "write_file": write_file,
    "list_files": list_files,
    "run_command": run_command,
    "search_code": search_code,
    "create_file": create_file,
    "delete_file": delete_file,
}

TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the workspace. Returns file content as string.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file from workspace root, e.g. 'src/main.py'"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Write content to a file. Creates the file and parent directories if they don't exist.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file from workspace root"
                    },
                    "content": {
                        "type": "string",
                        "description": "The full content to write to the file"
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List all files and directories in the workspace or a subdirectory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to list (empty string or omit for workspace root)",
                        "default": ""
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Run a shell command in the workspace directory. Returns stdout and stderr. Times out after 30 seconds.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to execute"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_code",
            "description": "Search for a text pattern in files (case-insensitive grep). Returns matching lines with file paths and line numbers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The text pattern to search for"
                    },
                    "path": {
                        "type": "string",
                        "description": "Subdirectory to search in (empty for entire workspace)",
                        "default": ""
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_file",
            "description": "Create a new empty file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path for the new file"
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete a file or directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Relative path to the file or directory to delete"
                    }
                },
                "required": ["path"]
            }
        }
    }
]


async def execute_tool(name: str, arguments: dict) -> str:
    """Execute a tool by name with given arguments."""
    executor = TOOL_EXECUTORS.get(name)
    if not executor:
        return f"Unknown tool: {name}"
    try:
        result = await executor(**arguments)
        return result
    except Exception as e:
        return f"Error executing {name}: {e}"
