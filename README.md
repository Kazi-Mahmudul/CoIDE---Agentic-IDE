# CoIDE - Agentic Web IDE

CoIDE is a full-stack browser IDE with AI-assisted coding, terminal workflows, and production-oriented authentication.

It is designed as a portfolio-grade project that demonstrates:
- secure backend architecture
- real-time systems (terminal/websocket)
- multi-user isolation
- AI tool orchestration inside an IDE experience

## Why This Project Stands Out

- Built an end-to-end IDE experience in the browser (editor, explorer, terminal, chat).
- Added production-style auth with PostgreSQL persistence, email verification, and session controls.
- Enforced user-level workspace isolation across API, runtime, git, chat, and terminal flows.
- Prepared frontend and backend for independent deployment (Vercel projects).

## Core Features

- Multi-file code editing with Monaco
- File tree CRUD + upload/search
- Terminal sessions over WebSocket
- AI chat panel with tool execution + checkpoint restore
- Git status/diff/commit integration
- Project scaffolding templates
- Theme system and command palette UX

## Security and Authentication

- Email/password auth with strict validation
- Verified-email registration flow
- Bcrypt password hashing (`passlib`)
- JWT access tokens + DB-backed session validation
- Logout, logout-all, and token refresh endpoints
- Session expiration handling
- Duplicate registration prevention
- Brute-force protections (rate-limited login attempts by email + IP)
- Security headers and CORS controls

## Tech Stack

- Frontend: React, Vite, Zustand, Monaco, xterm.js
- Backend: FastAPI, WebSockets, PostgreSQL
- Auth/Security: JWT, bcrypt, SMTP verification email flow
- Deployment: Vercel-ready frontend + backend projects

## Architecture (High Level)

- `frontend/`: IDE shell and UI flows
- `backend/`: API, auth, runtime, terminal, chat/tool routing
- `backend/migrations/`: SQL schema migrations
- `workspace/users/<user_key>/`: per-user isolated workspace data

## Local Development

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### 1) Configure environment

Use example env files as templates:

- [`backend/.env.example`](backend/.env.example)
- [`frontend/.env.example`](frontend/.env.example)

`DATABASE_URL` is required for backend startup.

### 2) Backend

```bash
cd backend
pip install -r requirements.txt
python migrate.py
python main.py
```

Backend runs on `http://localhost:8000`.

### 3) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Deployment (Vercel)

Deploy frontend and backend as two separate projects.

### Backend project (`backend/`)

1. Create Vercel project with root `backend/`.
2. Set required env vars:
   - `DATABASE_URL`
   - `COIDE_AUTH_SECRET` (32+ chars)
   - `COIDE_CORS_ORIGINS`
   - `COIDE_BACKEND_PUBLIC_URL`
   - `COIDE_FRONTEND_PUBLIC_URL`
   - SMTP vars (`SMTP_*`)
3. Deploy.

### Frontend project (`frontend/`)

1. Create Vercel project with root `frontend/`.
2. Set:
   - `VITE_API_BASE=https://<backend-domain>`
   - `VITE_TERMINAL_WS_BASE=wss://<backend-domain>/ws/terminal`
3. Deploy.

## Production Notes

- User/account/session data is persistent in PostgreSQL.
- For durable multi-instance file persistence, use persistent storage for workspace files (not ephemeral serverless disk).
- WebSocket/PTY terminal workloads may need a long-running backend host for best reliability at scale.

## Recruiter Snapshot

If you are evaluating this as a candidate project, focus on:
- security depth (auth/session/rate-limit design)
- full-stack ownership (frontend UX to backend infra)
- practical deployment readiness
- multi-user safety and isolation in a complex interactive app
