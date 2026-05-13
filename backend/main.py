"""
FastAPI main application.
Mounts all routers, sets up CORS, ensures workspace/ exists.
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import WORKSPACE_DIR
from files import router as files_router
from agent import router as agent_router
from terminal import router as terminal_router
from chat.router import router as chat_router
from git_api import router as git_router
from runtime_api import router as runtime_router
from auth import router as auth_router
from auth import UserContext, get_current_user, get_workspace_dir
from fastapi import Depends

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
    os.makedirs(os.path.join(WORKSPACE_DIR, "users"), exist_ok=True)
    print(f"[Coide] Workspace: {WORKSPACE_DIR}")
    yield


app = FastAPI(title="Coide - Agentic Web IDE", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(files_router)
app.include_router(agent_router)
app.include_router(terminal_router)
app.include_router(chat_router)
app.include_router(git_router)
app.include_router(runtime_router)
app.include_router(auth_router)


@app.get("/")
async def root():
    return {"status": "ok", "app": "Coide Agentic IDE"}


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
