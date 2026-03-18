# BD Agent — Business Development Intelligence Platform

An AI-powered research platform that ingests live news, runs configurable research agents against it, and surfaces the companies and insights most relevant to your business development priorities.

---

## What It Does

BD Agent pulls articles from TechCrunch and Crunchbase News every 60 minutes, tags each article with the companies mentioned, and organises everything into four views:

**Overview** — A personalised dashboard showing your executive summaries, an LLM-shortlisted list of the 5 most strategically relevant companies based on your research prompts, and recommended articles aligned to your interests.

**Agents** — Create research agents, each defined by a natural-language prompt (e.g. *"AI startup funding rounds in enterprise SaaS"*). Each agent searches the vector store for the most relevant articles, generates an executive summary, and ranks articles by relevance. Agents persist across sessions and can be expanded to view their full article list in a side drawer.

**Articles** — A searchable grid of all ingested news articles, filterable by keyword, title, or company name.

**Sources** — Manage the active RSS feeds and any custom sources (URLs, PDFs, DOCX files) you've added to the knowledge base.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Frontend                         │
│  Overview · Agents · Articles · Sources  (Next.js 14)   │
└────────────────────┬────────────────────────────────────┘
                     │ /api/* (SSE + REST)
┌────────────────────▼────────────────────────────────────┐
│                       Backend (FastAPI)                  │
│                                                         │
│  /api/articles          Article listing + company tags  │
│  /api/research-agents   Agent search + summary + name   │
│  /api/overview          Shortlisted companies (LLM)     │
│  /api/feeds             RSS refresh                     │
│  /api/sources           Custom source CRUD              │
│  /api/company           Article reader + chat (SSE)     │
│  /api/chat              Global research chat (SSE)      │
└──────┬──────────────────────────────────────┬───────────┘
       │                                      │
┌──────▼──────────┐                  ┌────────▼────────────┐
│  Chroma DB      │                  │  OpenAI API         │
│  (vector store) │                  │  GPT-4o-mini        │
│  news_articles  │                  │  text-embedding-    │
│  user docs      │                  │  3-small            │
└──────▲──────────┘                  └─────────────────────┘
       │
┌──────┴──────────────────────────────────────────────────┐
│  RSS Ingestion (APScheduler, 60-min interval)           │
│  TechCrunch · Crunchbase News                           │
│  feedparser → full-text scrape → chunk → embed → upsert│
└─────────────────────────────────────────────────────────┘
```

### Research Agent Pipeline

When an agent is created, the backend:
1. Runs a **similarity search** against the Chroma vector store using the research prompt (top 20 docs)
2. Deduplicates results by URL and enriches each article with **LLM-extracted company tags** (cached)
3. Generates an **executive summary** (max 5 sentences) and a **short display name** for the agent in parallel
4. Returns ranked articles, the summary, and the name to the frontend

### Article Chat Pipeline (LangGraph)

When a user chats about an article:
1. `rag_retrieval_node` — chunks and embeds the article, retrieves top-k passages
2. `web_search_node` — runs a Tavily web search for supplementary context
3. `synthesis_node` — streams a cited answer combining RAG + web results
4. `company_extraction_node` — extracts company names from the response

### Overview Intelligence

The Overview page calls `/api/overview/top-companies` with the user's agent prompts as interests. The backend:
1. Runs a similarity search per interest (k=10 per prompt)
2. Aggregates all companies mentioned in matching articles (ranked by frequency)
3. Passes the top 30 candidates to the LLM to select and explain the 5 most strategically relevant

Results are cached in `localStorage` and refreshed automatically when the agent count changes.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, LangGraph, LangChain |
| **LLM** | GPT-4o-mini (OpenAI) |
| **Embeddings** | text-embedding-3-small (OpenAI) |
| **Vector Store** | Chroma (persisted) |
| **Web Search** | Tavily API |
| **Article Fetching** | httpx + BeautifulSoup4 |
| **RSS Ingestion** | feedparser + APScheduler (60-min refresh) |
| **Frontend** | Next.js 14 (App Router), TypeScript |
| **Streaming** | Server-Sent Events (SSE) |
| **Styling** | Plain CSS Modules, dark-only (Aspen design system) |

---

## Features

- **Research Agents** — Define research topics as natural-language prompts; each agent independently searches the knowledge base, ranks articles by relevance, and generates an executive summary
- **Overview dashboard** — Personalised welcome page with executive summaries per agent, LLM-shortlisted companies, and recommended articles
- **Article dashboard** — Searchable, keyword-filterable grid of all ingested news articles with company tags
- **In-app article reader** — Full article HTML fetched and rendered in-app; no iframes
- **Article-grounded chat** — Ask questions about any article; answers are cited and grounded in that article's content only
- **Clickable citations** — `[N]` citations highlight the exact passage in the live article reader via the DOM Range API
- **Multi-source ingestion** — TechCrunch and Crunchbase News RSS feeds active by default; add custom URLs, PDFs, or DOCX files
- **Real-time streaming** — LLM output streams token-by-token with pipeline stage indicators
- **Persistent agents** — Agent prompts, article results, and summaries are stored in `localStorage` and survive page refreshes

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

Create `backend/.env`:

```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

Start the server:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. On first startup, TechCrunch and Crunchbase News articles are ingested and the Chroma vector store is populated.

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
| `GET` | `/api/articles` | List all ingested RSS articles with company tags |
| `POST` | `/api/research-agents/search` | Run agent search: returns ranked articles, summary, and name |
| `POST` | `/api/overview/top-companies` | LLM-shortlist of 5 companies based on research interests |
| `POST` | `/api/chat/stream` | Global research chat (SSE) — RAG + Tavily web search |
| `POST` | `/api/company/chat` | Article-grounded chat (SSE) |
| `GET` | `/api/company/article-content` | Fetch and clean article HTML for the reader |
| `POST` | `/api/feeds/refresh` | Manually trigger RSS feed refresh |
| `GET` | `/api/sources` | List custom sources |
| `POST` | `/api/sources/url` | Add a URL source |
| `POST` | `/api/sources/upload` | Upload a PDF or DOCX file (max 20 MB) |
| `DELETE` | `/api/sources/{id}` | Remove a custom source |
| `GET` | `/health` | Health check |

---

## Project Structure

```
bd-agent/
├── backend/
│   ├── agents/
│   │   ├── graph.py                  # LangGraph pipeline definition
│   │   ├── nodes.py                  # RAG, web search, synthesis, extraction nodes
│   │   └── state.py                  # ResearchState TypedDict
│   ├── api/
│   │   ├── articles.py               # Article listing + LLM company tagging
│   │   ├── chat.py                   # Global research chat (SSE)
│   │   ├── company.py                # Article reader + article chat (SSE)
│   │   ├── feeds.py                  # RSS refresh endpoint
│   │   ├── overview.py               # Top-companies shortlisting
│   │   ├── research_agents.py        # Agent search, summary, and name generation
│   │   └── sources.py                # Custom source CRUD
│   ├── ingestion/
│   │   ├── rss_ingester.py           # RSS parsing, full-text scraping, chunking
│   │   ├── source_processor.py       # URL / PDF / DOCX processing
│   │   └── vector_store.py           # Chroma singleton
│   ├── config.py                     # RSS feeds, model, and schedule config
│   └── main.py                       # FastAPI app + APScheduler startup
└── frontend/
    └── src/
        ├── components/
        │   ├── agents/                # AgentsView — card grid + article drawer
        │   ├── articles/              # ArticleDashboard, ArticleCard, ArticleDetail, ArticleChat
        │   ├── feeds/                 # FeedsView — RSS + custom source management
        │   ├── layout/                # AppLayout — nav tabs + view routing
        │   ├── overview/              # OverviewView — welcome, summaries, companies, articles
        │   └── ui/                    # Shared components (Spinner)
        ├── hooks/
        │   └── useCompanyChat.ts      # SSE client for article chat
        ├── lib/
        │   └── api.ts                 # Typed API fetch helpers
        └── types/
            └── index.ts               # Shared TypeScript interfaces
```

---

## Configuration

Edit `backend/config.py` to change:
- **RSS feeds** — add or remove feed URLs and names
- **Refresh interval** — defaults to 60 minutes
- **Chroma persist directory** — defaults to `./chroma_db`

Set `openai_model` in `backend/.env` to override the default `gpt-4o-mini`.

---

## Data Persistence

| Data | Storage |
|---|---|
| News articles and custom documents | Chroma vector store (`backend/chroma_db/`) |
| Article company tags | `backend/article_companies.json` (LLM extraction cache) |
| Custom source metadata | `backend/user_sources.json` |
| Research agents (prompts, articles, summaries) | Browser `localStorage` |
| Shortlisted companies cache | Browser `localStorage` |
