# BD Agent — Business Development Intelligence Platform

A real-time AI research tool that surfaces relevant companies from live TechCrunch news. Read articles in-app, ask questions about them, and get cited answers grounded in the article text.

---

## What It Does

BD Agent ingests TechCrunch articles every 60 minutes, extracts the companies mentioned, and presents them as a browsable article dashboard. Click any article to open a split-pane view: the full article on the left, an Intelligence Chat on the right.

Ask a question — the backend freshly chunks the article, retrieves the most relevant passages via semantic search, and streams a cited answer. Citations like `[1]` are clickable and scroll to and highlight the exact passage in the article reader.

---

## Architecture

```
Article Dashboard
    │
    └─ Click article
           │
           ├─ Article Reader ── fetches + renders full article HTML (server-side)
           │
           └─ Intelligence Chat
                  │
                  ├─[1] Fetch article text + chunk into ~500-char passages
                  │
                  ├─[2] Embed passages + query (text-embedding-3-small)
                  │
                  ├─[3] Retrieve top-k passages by cosine similarity
                  │
                  └─[4] GPT-4o-mini streams cited answer ([1], [2], ...)
                             │
                             └─ Click citation → highlight passage in reader
```

RSS ingestion and article company tagging run in the background via **APScheduler**. The pipeline is built with **LangGraph** and streams over **Server-Sent Events (SSE)**.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | FastAPI, LangGraph, LangChain |
| **LLM** | GPT-4o-mini (OpenAI) |
| **Embeddings** | text-embedding-3-small (OpenAI) |
| **Vector Store** | Chroma (persisted) |
| **Article Fetching** | httpx + BeautifulSoup4 |
| **RSS Ingestion** | feedparser + APScheduler (60-min refresh) |
| **Frontend** | Next.js 14 (App Router), TypeScript |
| **Streaming** | Server-Sent Events |
| **Styling** | Plain CSS Modules, dark-only design system |

---

## Features

- **Article dashboard** — Cards for every ingested TechCrunch article, tagged with the companies mentioned
- **In-app article reader** — Full article HTML fetched and rendered server-side; no iframes
- **Article-grounded chat** — Each chat session freshly chunks and embeds the selected article; answers are grounded only in that article's content
- **Clickable citations** — `[N]` citations scroll to and highlight the exact passage in the live article reader, with cross-node DOM text matching
- **Real-time streaming** — LLM output streams token-by-token with pipeline status updates
- **Custom data sources** — Add URLs, PDFs, or DOCX files; chunked and embedded into the vector store

---

## Demo

[Watch the Loom walkthrough](https://www.loom.com/share/ba9fbd434375427ca80c0f3adae8b6f6)

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

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
```

Start the API server:

```bash
uvicorn main:app --reload
```

The backend runs at `http://localhost:8000`. On first startup, TechCrunch articles are ingested and the Chroma vector store is populated.

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
| `GET` | `/api/articles` | List all ingested articles with company tags |
| `POST` | `/api/company/chat` | Stream an article chat session (SSE) |
| `GET` | `/api/company/article-content` | Fetch and clean article HTML for the reader |
| `GET` | `/api/sources` | List all custom sources |
| `POST` | `/api/sources/url` | Add a URL (web page) |
| `POST` | `/api/sources/upload` | Upload a PDF or DOCX file (max 20 MB) |
| `DELETE` | `/api/sources/{id}` | Remove a source and clean vector store |
| `GET` | `/health` | Health check |

### SSE Event Types (`/api/company/chat`)

```
status    → pipeline stage update ("Chunking article...", "Generating cited answer...", etc.)
token     → incremental LLM output chunk
sources   → numbered source chunks used to generate the answer
done      → stream complete
```

---

## Project Structure

```
bd-agent/
├── backend/
│   ├── agents/
│   │   ├── graph.py              # LangGraph pipeline definition
│   │   ├── nodes.py              # RAG, synthesis, company extraction nodes
│   │   └── state.py              # ResearchState TypedDict
│   ├── api/
│   │   ├── articles.py           # Article list endpoint + company tagging
│   │   ├── company.py            # Article chat, RAG chunking, article reader
│   │   ├── feeds.py              # RSS refresh endpoint
│   │   └── sources.py            # Source CRUD endpoints
│   ├── ingestion/
│   │   ├── rss_ingester.py       # RSS feed parsing and full-text ingestion
│   │   ├── source_processor.py   # URL / PDF / DOCX processing
│   │   └── vector_store.py       # Chroma singleton
│   ├── config.py                 # Environment, model, and schedule config
│   └── main.py                   # FastAPI app entry point
└── frontend/
    └── src/
        ├── components/
        │   ├── articles/          # ArticleDashboard, ArticleCard, ArticleDetail, ArticleChat
        │   ├── layout/            # AppLayout
        │   └── ui/                # Shared UI components (Spinner, etc.)
        ├── hooks/
        │   └── useCompanyChat.ts  # SSE client for article chat
        └── types/
            └── index.ts           # Shared TypeScript interfaces
```

---

## Configuration

Edit `backend/config.py` to change:
- **LLM model** — defaults to `gpt-4o-mini`
- **RSS feeds** — add or remove feed URLs
- **Refresh interval** — defaults to 60 minutes
- **Chroma persist directory** — defaults to `./chroma_db`

---

## Data Persistence

| Data | Storage |
|---|---|
| News articles & custom documents | Chroma vector store (`backend/chroma_db/`) |
| Article company tags (cache) | `backend/article_companies.json` |
| User-added sources metadata | `backend/user_sources.json` |
