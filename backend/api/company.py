"""Company-specific research endpoints."""
import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from config import settings
from ingestion.vector_store import get_retriever, get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/company", tags=["company"])


def _sse(event_type: str, data: dict | str) -> str:
    return f"data: {json.dumps({'type': event_type, 'content': data})}\n\n"


# ---------------------------------------------------------------------------
# Source helpers
# ---------------------------------------------------------------------------

def _build_sources(company_name: str, query: str = "", k: int = 8) -> list[dict]:
    """RAG retrieval: top-k chunks most relevant to company + query."""
    retriever = get_retriever(k=k)
    combined = f"{company_name} {query}".strip()
    docs = retriever.invoke(combined)
    return [
        {
            "id": str(i + 1),
            "title": doc.metadata.get("title", "Untitled"),
            "url": doc.metadata.get("url", ""),
            "source": doc.metadata.get("source", ""),
            "text": doc.page_content,
        }
        for i, doc in enumerate(docs)
    ]


def _get_article_context(url: str) -> dict | None:
    """
    Parent-document retrieval: fetch every stored chunk whose URL matches,
    concatenate them in order, and return the full document as a single source.
    Returns None if no chunks are found.
    """
    collection = get_vector_store()._collection
    results = collection.get(where={"url": url}, include=["documents", "metadatas"])

    docs = results.get("documents") or []
    metas = results.get("metadatas") or []
    if not docs:
        return None

    title = metas[0].get("title", "") if metas else ""
    source_name = metas[0].get("source", "") if metas else ""
    full_text = "\n\n".join(docs)

    return {
        "id": "1",
        "title": title,
        "url": url,
        "source": source_name,
        "text": full_text,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

class CompanyArticlesRequest(BaseModel):
    company_name: str


@router.post("/articles")
async def get_company_articles(req: CompanyArticlesRequest):
    """Return the top relevant source chunks for a company (for the article viewer)."""
    sources = _build_sources(req.company_name)
    return {"sources": sources}


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

COMPANY_CHAT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a business intelligence analyst. Answer questions about {company_name} \
using ONLY the provided numbered sources.
Include inline citations like [1], [2] after every factual claim — use the number matching the source.
Be specific and concise. Only assert what the sources directly support.""",
        ),
        (
            "human",
            """Company: {company_name}
Question: {query}

Sources:
{sources_text}

Answer with inline citations:""",
        ),
    ]
)

ARTICLE_CHAT_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a business intelligence analyst. Answer questions using ONLY the provided article.
Include an inline citation [1] after every factual claim drawn from the article.
Be specific and concise. Only assert what the article directly supports.""",
        ),
        (
            "human",
            """Article: {title} ({source_name})

Content:
{article_text}

Question: {query}

Answer with inline citations:""",
        ),
    ]
)


# ---------------------------------------------------------------------------
# Streaming chat
# ---------------------------------------------------------------------------

class CompanyChatRequest(BaseModel):
    company_name: str
    query: str
    article_url: str | None = None


async def _stream_company_chat(
    company_name: str, query: str, article_url: str | None
) -> AsyncGenerator[str, None]:

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        streaming=True,
        temperature=0,
    )

    # ── Article-focused mode ─────────────────────────────────────────────────
    if article_url:
        yield _sse("status", {"message": "Loading full article..."})
        await asyncio.sleep(0)

        parent_doc = _get_article_context(article_url)

        if parent_doc:
            yield _sse("status", {"message": "Generating cited answer..."})
            await asyncio.sleep(0)

            chain = ARTICLE_CHAT_PROMPT | llm
            async for chunk in chain.astream(
                {
                    "title": parent_doc["title"],
                    "source_name": parent_doc["source"],
                    "article_text": parent_doc["text"],
                    "query": query,
                }
            ):
                if chunk.content:
                    yield _sse("token", {"text": chunk.content})

            yield _sse("sources", {"sources": [parent_doc]})
            yield _sse("done", {"message": "Complete"})
            return

        # Chunk not found in store (e.g. web-search-only result) — fall through
        logger.warning(
            "No stored chunks for article_url=%s; falling back to company RAG", article_url
        )

    # ── General company RAG mode ─────────────────────────────────────────────
    yield _sse("status", {"message": f"Retrieving sources for {company_name}..."})
    await asyncio.sleep(0)

    sources = _build_sources(company_name, query, k=8)

    if not sources:
        yield _sse("token", {"text": f"No relevant sources found for {company_name}."})
        yield _sse("done", {"message": "Complete"})
        return

    sources_text = "\n\n".join(
        f"[{s['id']}] {s['title']} — {s['source']}\n{s['text']}"
        for s in sources
    )

    yield _sse("status", {"message": "Generating cited answer..."})
    await asyncio.sleep(0)

    chain = COMPANY_CHAT_PROMPT | llm
    async for chunk in chain.astream(
        {"company_name": company_name, "query": query, "sources_text": sources_text}
    ):
        if chunk.content:
            yield _sse("token", {"text": chunk.content})

    yield _sse("sources", {"sources": sources})
    yield _sse("done", {"message": "Complete"})


@router.post("/chat")
async def company_chat(req: CompanyChatRequest):
    return StreamingResponse(
        _stream_company_chat(req.company_name, req.query, req.article_url),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
