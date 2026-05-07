"""
FastAPI main application.
Mounts all routers, sets up CORS, ensures workspace/ exists.
"""

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from files import router as files_router
from agent import router as agent_router
from terminal import router as terminal_router
from chat.router import router as chat_router

logging.basicConfig(level=logging.INFO)

WORKSPACE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "workspace"
)

app = FastAPI(title="Coide - Agentic Web IDE", version="1.0.0")

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


@app.on_event("startup")
async def startup():
    os.makedirs(WORKSPACE_DIR, exist_ok=True)
    print(f"[Coide] Workspace: {WORKSPACE_DIR}")


@app.get("/")
async def root():
    return {"status": "ok", "app": "Coide Agentic IDE"}


@app.get("/git/branch")
async def git_branch():
    """Return current git branch name for the workspace."""
    import subprocess
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            cwd=WORKSPACE_DIR,
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
