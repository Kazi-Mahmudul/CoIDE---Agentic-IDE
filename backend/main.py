"""
FastAPI main application.
Mounts all routers, sets up CORS, ensures workspace/ exists.
"""

import logging
import os
import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import WORKSPACE_DIR
from db import apply_migrations
from files import router as files_router
from agent import router as agent_router
from terminal import router as terminal_router
from chat.router import router as chat_router
from git_api import router as git_router
from runtime_api import router as runtime_router
from project_api import router as project_router
from auth import router as auth_router
from auth import UserContext, get_current_user, get_workspace_dir
from fastapi import Depends
from workspace import ensure_workspace_root

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("coide.api")
STARTUP_ERRORS: list[str] = []


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        apply_migrations()
    except Exception as e:
        msg = f"Migration error: {e}"
        STARTUP_ERRORS.append(msg)
        logger.exception(msg)
    try:
        ensure_workspace_root()
    except Exception as e:
        msg = f"Workspace init error: {e}"
        STARTUP_ERRORS.append(msg)
        logger.exception(msg)
    print(f"[Coide] Workspace: {WORKSPACE_DIR}")
    yield


app = FastAPI(title="Coide - Agentic Web IDE", version="1.0.0", lifespan=lifespan)

_cors_origins_env = os.environ.get("COIDE_CORS_ORIGINS", "*").strip()
ALLOWED_ORIGINS = ["*"] if _cors_origins_env == "*" else [
    origin.strip() for origin in _cors_origins_env.split(",") if origin.strip()
]
ALLOW_CREDENTIALS = False if ALLOWED_ORIGINS == ["*"] else True

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    request.state.request_id = request_id
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled server error", extra={"request_id": request_id, "path": request.url.path})
        raise
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    response.headers["x-content-type-options"] = "nosniff"
    response.headers["x-frame-options"] = "DENY"
    response.headers["referrer-policy"] = "same-origin"
    response.headers["content-security-policy"] = "default-src 'self'; frame-ancestors 'none'"
    response.headers["x-request-id"] = request_id
    logger.info("%s %s -> %s (%sms)", request.method, request.url.path, response.status_code, elapsed_ms)
    return response


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "status": "error",
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "request_id": request_id,
            },
            "detail": exc.detail,
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", None)
    logger.exception("Unhandled exception", extra={"request_id": request_id, "path": request.url.path})
    return JSONResponse(
        status_code=500,
        content={
            "status": "error",
            "error": {
                "code": 500,
                "message": "Internal server error",
                "request_id": request_id,
            },
            "detail": "Internal server error",
        },
    )

app.include_router(files_router)
app.include_router(agent_router)
app.include_router(terminal_router)
app.include_router(chat_router)
app.include_router(git_router)
app.include_router(runtime_router)
app.include_router(project_router)
app.include_router(auth_router)


@app.get("/")
async def root():
    return {
        "status": "ok" if not STARTUP_ERRORS else "degraded",
        "app": "Coide Agentic IDE",
        "workspace": WORKSPACE_DIR,
        "startup_errors": STARTUP_ERRORS[:3],
    }


@app.get("/git/branch")
async def git_branch(user: UserContext = Depends(get_current_user)):
    """Return current git branch name for the workspace."""
    import subprocess
    workspace_dir = get_workspace_dir(user)
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=workspace_dir,
            capture_output=True,
            text=True,
            timeout=3,
        )
        if result.returncode == 0:
            branch = result.stdout.strip()
            return {"branch": branch}
    except Exception:
        pass
    return {"branch": None}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
