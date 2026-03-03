# BD Agent — Business Development Intelligence Platform

A real-time AI research assistant that identifies and surfaces relevant companies from live news feeds, web searches, and custom documents. Built for business development and sales teams who need to move fast.

---

## What It Does

Ask a research question — BD Agent searches across multiple sources simultaneously, synthesizes the findings with an LLM, and automatically extracts the companies mentioned. Results stream back in real time.

**Example queries:**
- *"Which Boston-area biotech companies are raising Series B funding?"*
- *"SaaS companies expanding into healthcare IT this quarter"*
- *"Logistics startups that recently announced partnerships"*

Results include a synthesized written answer and a structured sidebar of extracted companies with relevance context and source links. One click exports the full report as Markdown.

---

## Architecture

```
User Query
    │
    ├─[1] RAG Retrieval ──── Chroma vector store (news archive + custom docs)
    │
    ├─[2] Web Search ──────── Tavily (real-time, advanced depth)
    │
    ├─[3] Synthesis ──────── GPT-4o-mini (streams token-by-token to UI)
    │
    └─[4] Company Extraction ─ Structured JSON: name, context, source, URL
```

The pipeline is orchestrated with **LangGraph**. Results are streamed over **Server-Sent Events (SSE)** so you see each stage as it happens: *Retrieving → Searching → Analysing → Identifying companies...*

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, LangGraph, LangChain |
| **LLM** | GPT-4o-mini (OpenAI) |
| **Embeddings** | text-embedding-3-small (OpenAI) |
| **Vector Store** | Chroma (persisted) |
| **Web Search** | Tavily API |
| **RSS Ingestion** | feedparser + APScheduler (60-min refresh) |
| **Document Parsing** | pypdf, python-docx, BeautifulSoup4 |
| **Frontend** | Next.js 14 (App Router), TypeScript |
| **Streaming** | Server-Sent Events |
| **Styling** | Plain CSS Modules, dark-only design |

---

## Features

- **Real-time streaming** — LLM output appears token-by-token; status bar tracks pipeline stage
- **Multi-session chat** — Open multiple research threads in tabs; sessions persist across browser refresh
- **Company sidebar** — Extracted companies shown in a structured panel; click any message to view its companies
- **Report export** — One-click Markdown report with query, answer, and company list
- **Custom data sources** — Add URLs (RSS feeds or web pages), PDFs, or DOCX files; chunked and embedded into the vector store
- **Automatic news ingestion** — Boston BIZ Journal, Yahoo Finance, and TechCrunch ingested every 60 minutes on startup
- **Source management** — View, manage, and delete custom sources with live chunk counts

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key
- Tavily API key

### 1. Clone

```bash
git clone git@github.com:alphabetkang/bd-agent.git
cd bd-agent
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

Start the API server:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. On first startup, RSS feeds are ingested and the Chroma vector store is populated.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. Next.js proxies all `/api/*` requests to the FastAPI backend.

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat/stream` | Stream a research query (SSE) |
| `GET` | `/api/sources` | List all custom sources |
| `POST` | `/api/sources/url` | Add a URL (RSS feed or web page) |
| `POST` | `/api/sources/upload` | Upload a PDF or DOCX file (max 20 MB) |
| `DELETE` | `/api/sources/{id}` | Remove a source and clean vector store |
| `POST` | `/api/feeds/refresh` | Manually trigger RSS ingestion |
| `POST` | `/api/reports/export` | Generate and download a Markdown report |
| `GET` | `/health` | Health check |

### SSE Event Types (`/api/chat/stream`)

```
status    → pipeline stage update ("Retrieving...", "Searching...", etc.)
token     → incremental LLM output chunk
companies → structured array of extracted companies (after synthesis)
done      → stream complete
error     → error message
```

---

## Project Structure

```
bd-agent/
├── backend/
│   ├── agents/
│   │   ├── graph.py          # LangGraph pipeline definition
│   │   ├── nodes.py          # RAG, web search, synthesis, extraction nodes
│   │   └── state.py          # ResearchState TypedDict
│   ├── api/
│   │   ├── chat.py           # SSE streaming endpoint
│   │   ├── feeds.py          # RSS refresh endpoint
│   │   ├── reports.py        # Report export endpoint
│   │   └── sources.py        # Source CRUD endpoints
│   ├── ingestion/
│   │   ├── rss_ingester.py   # RSS feed parsing and ingestion
│   │   ├── source_processor.py # URL / PDF / DOCX processing
│   │   └── vector_store.py   # Chroma singleton
│   ├── config.py             # Environment, model, and schedule config
│   └── main.py               # FastAPI app entry point
└── frontend/
    └── src/
        ├── components/
        │   ├── chat/          # ChatInterface, MessageList, MessageItem
        │   ├── companies/     # CompaniesPanel, CompanyCard
        │   ├── feeds/         # FeedsView
        │   ├── layout/        # AppLayout, Sidebar
        │   └── sources/       # AddSourceModal
        ├── hooks/
        │   └── useSessions.ts # Session management + SSE client
        └── types/
            └── index.ts       # Shared TypeScript interfaces
```

---

## Configuration

Edit `backend/config.py` to change:
- **LLM model** — defaults to `gpt-4o-mini`
- **RSS feeds** — add or remove feed URLs
- **Refresh interval** — defaults to 60 minutes
- **Chroma persist directory** — defaults to `./chroma_db`
- **RAG retrieval count** — defaults to `k=6` documents

---

## Data Persistence

| Data | Storage |
|---|---|
| News articles & custom documents | Chroma vector store (`backend/chroma_db/`) |
| User-added sources metadata | `backend/user_sources.json` |
| Chat sessions | Browser localStorage |
