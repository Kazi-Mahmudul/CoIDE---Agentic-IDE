"""
Context builder: assembles system prompt with workspace context.
"""
from __future__ import annotations

import os
import subprocess
from typing import Optional

import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import WORKSPACE_DIR
def get_git_branch(workspace_dir: str) -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=workspace_dir, capture_output=True, text=True, timeout=3
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return "unknown"


def estimate_tokens(text: str) -> int:
    """Rough token estimate: chars / 4."""
    return len(text) // 4


def build_system_prompt(
    mode: str,
    workspace_dir: str = WORKSPACE_DIR,
    active_file: Optional[str] = None,
    active_file_content: Optional[str] = None,
    selection: Optional[str] = None,
    diagnostics: Optional[list] = None,
    git_branch: Optional[str] = None,
    codebase_summary: Optional[str] = None,
    attached_files: Optional[list] = None,
    terminal_output: Optional[str] = None,
    max_file_lines: int = 200,
) -> str:
    branch = git_branch or get_git_branch(workspace_dir)

    if mode == "chat":
        base = f"""You are an expert AI coding assistant integrated into a web IDE called Coide.
You answer questions clearly and concisely. You have full context of the user's workspace.
Current workspace: {workspace_dir}
Git branch: {branch}"""
    else:
        base = f"""You are an expert AI coding assistant integrated into a web IDE called Coide.
You have access to the user's real filesystem, terminal, and editor via tools.
You can read files, write code, run commands, search the codebase, and apply changes.

Always think step-by-step:
1. Read relevant files first before making changes
2. Make targeted, minimal changes
3. After writing files, verify by reading them back
4. Run tests or commands to validate changes when appropriate
5. Be concise in explanations but thorough in implementation

Current workspace: {workspace_dir}
Git branch: {branch}"""

    parts = [base]

    if active_file:
        parts.append(f"\nCurrently open file: {active_file}")
        if active_file_content:
            lines = active_file_content.splitlines()
            if len(lines) > max_file_lines:
                content_preview = "\n".join(lines[:max_file_lines]) + f"\n... ({len(lines) - max_file_lines} more lines)"
            else:
                content_preview = active_file_content
            parts.append(f"```\n{content_preview}\n```")

    if selection:
        parts.append(f"\nCurrently selected text:\n```\n{selection}\n```")

    if diagnostics:
        diag_lines = []
        for d in diagnostics[:20]:
            sev = "ERROR" if d.get("severity") == 8 else "WARNING"
            diag_lines.append(f"  {sev}: {d.get('message')} ({d.get('file', active_file)}:{d.get('startLineNumber', '?')})")
        if diag_lines:
            parts.append(f"\nCurrent diagnostics:\n" + "\n".join(diag_lines))

    if attached_files:
        for af in attached_files[:5]:
            path = af.get("path", "unknown")
            content = af.get("content", "")
            if len(content) > 5000:
                content = content[:5000] + "\n... (truncated)"
            parts.append(f"\nAttached file: {path}\n```\n{content}\n```")

    if terminal_output:
        parts.append(f"\nRecent terminal output:\n```\n{terminal_output[-2000:]}\n```")

    if codebase_summary:
        parts.append(f"\nCodebase summary:\n{codebase_summary}")

    return "\n".join(parts)
