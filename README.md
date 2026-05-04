# Coide – Agentic Web IDE

A full-stack agentic web IDE with Monaco Editor, real PTY terminal, and LLM-powered coding agent.

## Architecture

- **Backend**: Python FastAPI + uvicorn, WebSocket PTY shell, file CRUD, agent loop
- **Frontend**: React + Vite + Tailwind CSS, Monaco Editor, xterm.js terminal, streaming chat
- **LLM**: Any OpenAI-compatible provider (Groq, OpenRouter, Google AI Studio, Ollama)

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+

### Backend

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend starts on **http://localhost:8000**.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**.

### First Run

1. Open http://localhost:5173
2. The **Model Configuration** modal appears automatically
3. Choose a preset (Groq, OpenRouter, etc.) or enter your own:
   - **API Base URL**: e.g. `https://api.groq.com/openai/v1`
   - **Model**: e.g. `llama-3.3-70b-versatile`
   - **API Key**: your provider API key
4. Click **Save**

## Usage

- **File Explorer** (left): Browse, open, create, rename, delete files in `workspace/`
- **Editor** (center top): Monaco editor with syntax highlighting. `Ctrl+S` to save
- **Terminal** (center bottom): Real bash shell in `workspace/`
- **Agent Chat** (right): Ask the agent to write, refactor, or explain code

## Supported LLM Providers

| Provider | Base URL | Notes |
|---|---|---|
| Groq | `https://api.groq.com/openai/v1` | Fast inference |
| OpenRouter | `https://openrouter.ai/api/v1` | Many models |
| Google AI Studio | `https://generativelanguage.googleapis.com/v1beta/openai` | Gemini models |
| Ollama | `http://localhost:11434/v1` | Local models, no API key needed |

## Project Structure

```
project/
├── backend/
│   ├── main.py          # FastAPI app, CORS, routers
│   ├── agent.py         # Agent loop with tool calling
│   ├── tools.py         # Tool definitions and executors
│   ├── terminal.py      # WebSocket PTY shell
│   ├── files.py         # File CRUD REST endpoints
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Three-panel layout
│   │   ├── api.js               # All fetch/stream calls
│   │   ├── components/
│   │   │   ├── Editor.jsx       # Monaco editor
│   │   │   ├── FileTree.jsx     # Sidebar file explorer
│   │   │   ├── Terminal.jsx     # xterm.js terminal
│   │   │   ├── ChatPanel.jsx    # Agent chat + streaming
│   │   │   └── ConfigModal.jsx  # Model config modal
│   │   └── hooks/
│   │       ├── useFileTree.js
│   │       └── useAgent.js
│   ├── package.json
│   └── vite.config.js
└── workspace/           # Your project files live here
```
