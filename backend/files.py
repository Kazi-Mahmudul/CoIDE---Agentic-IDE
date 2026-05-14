"""
File CRUD REST endpoints for the IDE.

Two modes:
  1. Workspace-relative paths  → /files/* endpoints (sandboxed to workspace/)
  2. Absolute/external paths   → /external/* endpoints (any path the OS allows)

The frontend switches between modes when the user opens a local folder.
"""

import os
import re
import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from auth import UserContext, get_current_user, get_workspace_dir
from workspace import resolve_workspace_path

router = APIRouter(tags=["files"])


# ─────────────────────────── helpers ─────────────────────────────────────────

def _safe_workspace_path(workspace_dir: str, path: str) -> str:
    """Resolve a workspace-relative path, blocking traversal."""
    return resolve_workspace_path(workspace_dir, path)


def _build_tree(dir_path: str, base: str) -> list:
    """Recursively build a file tree. `base` is used to compute relative paths."""
    entries = []
    try:
        items = sorted(os.listdir(dir_path))
    except PermissionError:
        return entries

    SKIP = {"node_modules", "__pycache__", "venv", ".git", ".venv", "dist", ".next", "build"}

    for item in items:
        if item.startswith(".") or item in SKIP:
            continue
        full = os.path.join(dir_path, item)
        rel = os.path.relpath(full, base).replace("\\", "/")
        if os.path.isdir(full):
            entries.append({
                "name": item,
                "path": rel,
                "type": "directory",
                "children": _build_tree(full, base),
            })
        else:
            entries.append({"name": item, "path": rel, "type": "file"})
    return entries


# ═════════════════════════ WORKSPACE endpoints ════════════════════════════════

@router.get("/files/tree")
async def get_file_tree(user: UserContext = Depends(get_current_user)):
    """Return the full file tree of workspace/ as JSON."""
    workspace_dir = get_workspace_dir(user)
    os.makedirs(workspace_dir, exist_ok=True)
    return {"tree": _build_tree(workspace_dir, workspace_dir), "root": workspace_dir}


@router.get("/files/read")
async def read_file(path: str = Query(...), user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    safe = _safe_workspace_path(workspace_dir, path)
    if not os.path.isfile(safe):
        raise HTTPException(status_code=404, detail=f"File not found: {path}")
    try:
        with open(safe, "r", encoding="utf-8", errors="replace") as f:
            return {"path": path, "content": f.read()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class WriteBody(BaseModel):
    path: str
    content: str


@router.post("/files/write")
async def write_file(body: WriteBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    safe = _safe_workspace_path(workspace_dir, body.path)
    try:
        os.makedirs(os.path.dirname(safe), exist_ok=True)
        with open(safe, "w", encoding="utf-8") as f:
            f.write(body.content)
        return {"status": "ok", "path": body.path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class CreateBody(BaseModel):
    path: str
    is_dir: bool = False


@router.post("/files/create")
async def create_file(body: CreateBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    safe = _safe_workspace_path(workspace_dir, body.path)
    try:
        if body.is_dir:
            os.makedirs(safe, exist_ok=True)
            return {"status": "ok", "path": body.path, "type": "directory"}
        else:
            os.makedirs(os.path.dirname(safe) or workspace_dir, exist_ok=True)
            if not os.path.exists(safe):
                open(safe, "w").close()
            return {"status": "ok", "path": body.path, "type": "file"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/files/delete")
async def delete_file(path: str = Query(...), user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    safe = _safe_workspace_path(workspace_dir, path)
    if not os.path.exists(safe):
        raise HTTPException(status_code=404, detail=f"Not found: {path}")
    try:
        if os.path.isfile(safe):
            os.remove(safe)
        else:
            shutil.rmtree(safe)
        return {"status": "ok", "path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/files/search")
async def search_files(
    q: str = Query(..., description="Search query"),
    case_sensitive: bool = Query(False),
    whole_word: bool = Query(False),
    use_regex: bool = Query(False),
    user: UserContext = Depends(get_current_user),
):
    """Full-text search across all workspace files."""
    if not q.strip():
        return {"results": []}
    workspace_dir = get_workspace_dir(user)

    results = []
    max_results = 100
    pattern = None
    flags = 0 if case_sensitive else re.IGNORECASE
    if use_regex:
        try:
            expr = q if not whole_word else rf"\b(?:{q})\b"
            pattern = re.compile(expr, flags)
        except re.error as e:
            raise HTTPException(status_code=400, detail=f"Invalid regex: {e}")
    elif whole_word:
        pattern = re.compile(rf"\b{re.escape(q)}\b", flags)

    for root, dirs, files in os.walk(workspace_dir):
        dirs[:] = [d for d in dirs if not d.startswith('.') and d not in (
            'node_modules', '__pycache__', 'venv', '.git', '.venv', 'dist', '.next', 'build'
        )]
        for fname in files:
            if len(results) >= max_results:
                break
            fpath = os.path.join(root, fname)
            rel = os.path.relpath(fpath, workspace_dir).replace("\\", "/")
            try:
                with open(fpath, "r", encoding="utf-8", errors="strict") as f:
                    for line_no, line in enumerate(f, 1):
                        line_match = False
                        if pattern:
                            line_match = pattern.search(line) is not None
                        elif case_sensitive:
                            line_match = q in line
                        else:
                            line_match = q.lower() in line.lower()
                        if line_match:
                            results.append({
                                "file": rel,
                                "line": line_no,
                                "text": line.rstrip(),
                            })
                            if len(results) >= max_results:
                                break
            except (UnicodeDecodeError, PermissionError, OSError):
                continue

    return {"results": results, "total": len(results)}


class RenameBody(BaseModel):
    old_path: str
    new_path: str


@router.post("/files/rename")
async def rename_file(body: RenameBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    old_safe = _safe_workspace_path(workspace_dir, body.old_path)
    new_safe = _safe_workspace_path(workspace_dir, body.new_path)
    if not os.path.exists(old_safe):
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        os.makedirs(os.path.dirname(new_safe) or workspace_dir, exist_ok=True)
        shutil.move(old_safe, new_safe)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/files/upload")
async def upload_files(
    path: str = Query("", description="Optional destination directory"),
    files: list[UploadFile] = File(...),
    user: UserContext = Depends(get_current_user),
):
    """Upload one or more files into workspace."""
    if len(files) > 50:
        raise HTTPException(status_code=400, detail="Too many files (max 50)")

    workspace_dir = get_workspace_dir(user)
    dest_dir = _safe_workspace_path(workspace_dir, path) if path else workspace_dir
    os.makedirs(dest_dir, exist_ok=True)
    uploaded = []
    for f in files:
        filename = os.path.basename(f.filename or "").strip()
        if not filename:
            continue
        target = _safe_workspace_path(workspace_dir, os.path.join(path, filename) if path else filename)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        data = await f.read()
        with open(target, "wb") as out:
            out.write(data)
        uploaded.append(os.path.relpath(target, workspace_dir).replace("\\", "/"))
    return {"status": "ok", "files": uploaded}


# ═════════════════════════ EXTERNAL folder endpoints ═════════════════════════
# These operate on any absolute path the user explicitly opens.
# No sandbox restriction — the user chose the folder.

def _abs(path: str) -> str:
    """Normalise an absolute path."""
    p = os.path.abspath(os.path.normpath(path))
    if not os.path.isabs(p):
        raise HTTPException(status_code=400, detail="Path must be absolute")
    return p


@router.get("/external/tree")
async def external_tree(root: str = Query(..., description="Absolute folder path"), user: UserContext = Depends(get_current_user)):
    """Return file tree for any absolute folder path."""
    r = _abs(root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    if not os.path.isdir(r):
        raise HTTPException(status_code=404, detail="Directory not found")
    return {"tree": _build_tree(r, r), "root": r}


@router.get("/external/read")
async def external_read(
    root: str = Query(...),
    path: str = Query(..., description="Path relative to root"),
    user: UserContext = Depends(get_current_user),
):
    r = _abs(root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    full = os.path.normpath(os.path.join(r, path))
    # Ensure we stay inside the opened root
    if not full.startswith(r + os.sep) and full != r:
        raise HTTPException(status_code=400, detail="Path outside opened folder")
    if not os.path.isfile(full):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            return {"path": path, "content": f.read(), "abs": full}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExtWriteBody(BaseModel):
    root: str
    path: str
    content: str


@router.post("/external/write")
async def external_write(body: ExtWriteBody, user: UserContext = Depends(get_current_user)):
    r = _abs(body.root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    full = os.path.normpath(os.path.join(r, body.path))
    if not full.startswith(r + os.sep) and full != r:
        raise HTTPException(status_code=400, detail="Path outside opened folder")
    try:
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(body.content)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExtCreateBody(BaseModel):
    root: str
    path: str
    is_dir: bool = False


@router.post("/external/create")
async def external_create(body: ExtCreateBody, user: UserContext = Depends(get_current_user)):
    r = _abs(body.root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    full = os.path.normpath(os.path.join(r, body.path))
    if not full.startswith(r + os.sep) and full != r:
        raise HTTPException(status_code=400, detail="Path outside opened folder")
    try:
        if body.is_dir:
            os.makedirs(full, exist_ok=True)
        else:
            os.makedirs(os.path.dirname(full), exist_ok=True)
            if not os.path.exists(full):
                open(full, "w").close()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/external/delete")
async def external_delete(root: str = Query(...), path: str = Query(...), user: UserContext = Depends(get_current_user)):
    r = _abs(root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    full = os.path.normpath(os.path.join(r, path))
    if not full.startswith(r + os.sep) and full != r:
        raise HTTPException(status_code=400, detail="Path outside opened folder")
    if not os.path.exists(full):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        if os.path.isfile(full):
            os.remove(full)
        else:
            shutil.rmtree(full)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ExtRenameBody(BaseModel):
    root: str
    old_path: str
    new_path: str


@router.post("/external/rename")
async def external_rename(body: ExtRenameBody, user: UserContext = Depends(get_current_user)):
    r = _abs(body.root)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(r).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="External root must stay inside your workspace")
    old_full = os.path.normpath(os.path.join(r, body.old_path))
    new_full = os.path.normpath(os.path.join(r, body.new_path))
    for p in (old_full, new_full):
        if not p.startswith(r + os.sep) and p != r:
            raise HTTPException(status_code=400, detail="Path outside opened folder")
    if not os.path.exists(old_full):
        raise HTTPException(status_code=404, detail="Source not found")
    try:
        os.makedirs(os.path.dirname(new_full), exist_ok=True)
        shutil.move(old_full, new_full)
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/external/ls")
async def external_ls(path: str = Query(..., description="Absolute path to list"), user: UserContext = Depends(get_current_user)):
    """List immediate children of any absolute directory (for folder picker)."""
    p = _abs(path)
    user_root = Path(get_workspace_dir(user)).resolve()
    try:
        Path(p).resolve().relative_to(user_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Path must stay inside your workspace")
    if not os.path.isdir(p):
        raise HTTPException(status_code=404, detail="Not a directory")
    try:
        items = []
        for name in sorted(os.listdir(p)):
            if name.startswith("."):
                continue
            full = os.path.join(p, name)
            items.append({
                "name": name,
                "path": full.replace("\\", "/"),
                "type": "directory" if os.path.isdir(full) else "file",
            })
        # Also provide parent
        parent = os.path.dirname(p)
        return {
            "path": p.replace("\\", "/"),
            "parent": parent.replace("\\", "/") if parent != p else None,
            "items": items,
        }
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/external/roots")
async def external_roots(user: UserContext = Depends(get_current_user)):
    """Return allowed roots for current user."""
    user_root = get_workspace_dir(user).replace("\\", "/")
    return {"roots": [{"name": "My Workspace", "path": user_root}]}
