# Coide - Multi-User Web IDE

Coide is a web-based IDE with Monaco editing, multi-tab terminal, chat-assisted coding, and authenticated per-user workspace isolation.

## Tech Stack

- Frontend: React + Vite + Zustand + Monaco + xterm.js
- Backend: FastAPI + WebSocket terminal + tool/chat services
- Auth: Bearer token auth (`/auth/login`, `/auth/me`)

## Key Features

- IDE layout: activity bar, explorer, tabs, bottom panel, status bar
- Multi-file editing with save/save-all
- Explorer CRUD: create, rename, delete, upload
- IDE-style quick input for file/folder creation (replaces browser `prompt` dialogs)
- Multi-tab terminal with reconnect support
- Chat panel with tool execution and checkpoint restore
- Theme system with shared semantic tokens
- Secure multi-user workspace isolation

## Workspace Isolation

- Every user is scoped to a dedicated workspace path:
  - `workspace/users/<user_id>`
- Backend APIs require auth and enforce ownership checks before file access.
- Users cannot access other users' files, folders, terminal sessions, or workspace roots.
- Terminal, runtime execution, git operations, and chat tools all run inside the authenticated user's workspace.

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Backend runs on `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Default Local Login

For local development, default credentials are:

- Username: `demo`
- Password: `demo123`

You can override users via environment variable:

- `COIDE_USERS_JSON`

Example value:

```json
{
  "alice": { "password": "alice123", "user_id": "alice" },
  "bob": { "password": "bob123", "user_id": "bob" }
}
```

## Environment Variables

- `COIDE_AUTH_SECRET`: signing secret for auth tokens
- `COIDE_TOKEN_TTL_SECONDS`: token lifetime (default `86400`)
- `VITE_API_BASE`: frontend API base URL (optional)
- `VITE_TERMINAL_WS_BASE`: terminal websocket base URL (optional)

## Run Tests

### Frontend

```bash
cd frontend
npm test
```

### Backend

```bash
cd backend
python -m pytest -q
```

