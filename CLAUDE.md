# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload        # runs on :8000
```

Requires a `backend/.env` file:
```
OPENAI_API_KEY=...
TAVILY_API_KEY=...
```

### Frontend
```bash
cd frontend
npm install
npm run dev    # runs on :3000, proxies /api/* → http://localhost:8000/api/*
```

## Architecture Overview

This is a business development intelligence tool. The user types a natural-language query; the backend runs a multi-step AI research pipeline and streams results back via SSE.

### Backend (FastAPI + LangGraph)

**Entry point**: `backend/main.py` — mounts four API routers, runs an APScheduler job that refreshes RSS feeds every 60 minutes on startup.

**LangGraph pipeline** (`backend/agents/`):
1. `rag_retrieval_node` — queries the Chroma vector store (top-6 docs) for relevant news passages
2. `web_search_node` — runs a Tavily web search (advanced, max 5 results)
3. `synthesis_node` — streams an LLM answer combining RAG + web context
4. `company_extraction_node` — makes a second (non-streaming) LLM call to extract a JSON array of companies mentioned

State shape is defined in `backend/agents/state.py` (`ResearchState` TypedDict).

**Streaming** (`backend/api/chat.py`): The `/api/chat/stream` endpoint uses FastAPI `StreamingResponse` with `astream_events(version="v2")`. SSE events use the format `data: {"type": <type>, "content": <data>}\n\n`. Event types: `status`, `token`, `companies`, `done`.

**Vector store** (`backend/ingestion/vector_store.py`): Singleton Chroma collection `news_articles` persisted at `backend/chroma_db/`. Uses `text-embedding-3-small`. The LLM model defaults to `gpt-4o-mini` (configurable via `openai_model` in `.env`).

**Sources** (`backend/api/sources.py`): User-added sources (URLs, PDFs, DOCX) are chunked and embedded into the same Chroma collection, tracked in `backend/user_sources.json` with a `source_id` for deletion.

**RSS feeds** (`backend/config.py`): Boston Business Journal, Yahoo Finance, TechCrunch — ingested via `backend/ingestion/rss_ingester.py` and stored in Chroma.

### Frontend (Next.js 14 App Router)

**Key hook**: `frontend/src/hooks/useChat.ts` — manages SSE stream reading, accumulates tokens into the assistant message, attaches `companies` array to the message on the `companies` event.

**API calls**: `frontend/src/lib/api.ts` — report export, source management (add URL, upload file, delete).

**Types**: `frontend/src/types/index.ts` — canonical types shared across components.

## Design System (Aspen)

Dark-mode-only. All styling uses plain CSS modules (no Tailwind, no CSS-in-JS). CSS variables are defined globally. Key values:

- Accent: `#ffba28` (amber/gold) — used for active states, focus borders, highlights
- Backgrounds: `--bg-main: #0e0f13`, `--bg-surface: #1c1d21`, `--bg-hover: #25262a`
- Text: `--text-primary: #feffff`, `--text-secondary: #a5a6aa`, `--text-muted: #737478`
- Fonts: IBM Plex Sans (UI), IBM Plex Mono (code/labels)
- Transitions: always `0.15s ease`
- Border radius: `6px` (interactive elements), `8px` (cards/panels)

Full component specs are in `design.md`.
