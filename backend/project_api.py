"""
Project scaffolding endpoints for multi-file generation and bootstrap.
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import UserContext, get_current_user, get_workspace_dir
from workspace import resolve_workspace_path

router = APIRouter(prefix="/projects", tags=["projects"])


SCAFFOLDS: dict[str, dict[str, str]] = {
    "python-fastapi": {
        "main.py": (
            "from fastapi import FastAPI\n\n"
            "app = FastAPI()\n\n"
            "@app.get('/')\n"
            "async def health():\n"
            "    return {'status': 'ok'}\n"
        ),
        "requirements.txt": "fastapi==0.116.1\nuvicorn[standard]==0.35.0\n",
        "README.md": "# FastAPI App\n\nRun: `uvicorn main:app --reload`\n",
    },
    "node-express": {
        "package.json": (
            "{\n"
            '  "name": "coide-express-app",\n'
            '  "version": "1.0.0",\n'
            '  "private": true,\n'
            '  "type": "module",\n'
            '  "scripts": {\n'
            '    "start": "node src/index.js",\n'
            '    "dev": "node --watch src/index.js"\n'
            "  },\n"
            '  "dependencies": {\n'
            '    "express": "^4.21.2"\n'
            "  }\n"
            "}\n"
        ),
        "src/index.js": (
            "import express from 'express'\n\n"
            "const app = express()\n"
            "const port = process.env.PORT || 3000\n\n"
            "app.get('/', (_req, res) => {\n"
            "  res.json({ status: 'ok' })\n"
            "})\n\n"
            "app.listen(port, () => {\n"
            "  console.log(`Server listening on http://localhost:${port}`)\n"
            "})\n"
        ),
        "README.md": "# Express App\n\nRun: `npm install && npm run dev`\n",
    },
    "react-vite": {
        "package.json": (
            "{\n"
            '  "name": "coide-react-app",\n'
            '  "version": "1.0.0",\n'
            '  "private": true,\n'
            '  "type": "module",\n'
            '  "scripts": {\n'
            '    "dev": "vite",\n'
            '    "build": "vite build",\n'
            '    "preview": "vite preview"\n'
            "  },\n"
            '  "dependencies": {\n'
            '    "react": "^18.3.1",\n'
            '    "react-dom": "^18.3.1"\n'
            "  },\n"
            '  "devDependencies": {\n'
            '    "vite": "^5.4.11",\n'
            '    "@vitejs/plugin-react": "^4.3.2"\n'
            "  }\n"
            "}\n"
        ),
        "index.html": (
            "<!doctype html>\n"
            "<html>\n"
            "  <head>\n"
            '    <meta charset="UTF-8" />\n'
            '    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
            "    <title>Coide React App</title>\n"
            "  </head>\n"
            "  <body>\n"
            '    <div id="root"></div>\n'
            '    <script type="module" src="/src/main.jsx"></script>\n'
            "  </body>\n"
            "</html>\n"
        ),
        "src/main.jsx": (
            "import React from 'react'\n"
            "import { createRoot } from 'react-dom/client'\n"
            "import './styles.css'\n\n"
            "function App() {\n"
            "  return <h1>Coide React App</h1>\n"
            "}\n\n"
            "createRoot(document.getElementById('root')).render(<App />)\n"
        ),
        "src/styles.css": "body { font-family: sans-serif; padding: 2rem; }\n",
        "README.md": "# React + Vite\n\nRun: `npm install && npm run dev`\n",
    },
}


class ScaffoldBody(BaseModel):
    template: str = Field(description="Scaffold template key")
    name: str = Field(description="Project folder name inside workspace")
    install: bool = Field(default=False, description="Run dependency install after scaffold")


@router.get("/templates")
async def list_templates():
    return {"templates": sorted(SCAFFOLDS.keys())}


@router.post("/scaffold")
async def scaffold_project(body: ScaffoldBody, user: UserContext = Depends(get_current_user)):
    workspace_dir = get_workspace_dir(user)
    template = body.template.strip()
    files = SCAFFOLDS.get(template)
    if not files:
        raise HTTPException(status_code=400, detail=f"Unknown template: {template}")

    project_name = body.name.strip().replace("\\", "/")
    if not project_name or project_name in (".", ".."):
        raise HTTPException(status_code=400, detail="Invalid project name")

    project_dir = resolve_workspace_path(workspace_dir, project_name)
    Path(project_dir).mkdir(parents=True, exist_ok=True)

    created: list[str] = []
    for rel_path, content in files.items():
        target = resolve_workspace_path(workspace_dir, f"{project_name}/{rel_path}")
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        created.append(f"{project_name}/{rel_path}")

    install_output = ""
    if body.install:
        install_cmd = None
        if os.path.isfile(os.path.join(project_dir, "package.json")):
            install_cmd = ["npm", "install"]
        elif os.path.isfile(os.path.join(project_dir, "requirements.txt")):
            install_cmd = ["python", "-m", "pip", "install", "-r", "requirements.txt"]
        if install_cmd:
            try:
                proc = subprocess.run(
                    install_cmd,
                    cwd=project_dir,
                    capture_output=True,
                    text=True,
                    timeout=180,
                )
                install_output = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
            except Exception as e:
                install_output = f"Dependency install failed: {e}"

    return {
        "status": "ok",
        "template": template,
        "project_root": project_dir,
        "created_files": created,
        "install_output": install_output[-8000:],
    }
