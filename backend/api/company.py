"""Company-specific research endpoints."""
import asyncio
import json
import logging
import math
from typing import AsyncGenerator
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

# Cohere Rerank
from langchain_cohere import CohereRerank

from pydantic import BaseModel

from config import settings
from ingestion.vector_store import get_retriever

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/company", tags=["company"])

_cohere_compressor_cache: dict[int, CohereRerank] = {}


def _get_cohere_compressor(top_n: int) -> CohereRerank | None:
    """
    Lazily instantiate Cohere reranker.

    LangChain's Cohere client expects `CO_API_KEY` unless we pass `cohere_api_key`
    explicitly, so we do that via `settings.cohere_api_key`.
    """
    if top_n <= 0:
        return None

    if top_n in _cohere_compressor_cache:
        return _cohere_compressor_cache[top_n]

    try:
        compressor = CohereRerank(
            model="rerank-v3.5",
            top_n=top_n,
            cohere_api_key=settings.cohere_api_key,
        )
        _cohere_compressor_cache[top_n] = compressor
        return compressor
    except Exception as e:
        logger.warning("Cohere reranker init failed; disabling advanced rerank: %s", e)
        return None

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


# ---------------------------------------------------------------------------
# Article RAG helpers
# ---------------------------------------------------------------------------

# Cache: url → (title, chunks) so we don't re-fetch on every message
_article_chunk_cache: dict[str, tuple[str, list[str]]] = {}


def _cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


async def _fetch_and_chunk_article(url: str) -> tuple[str, list[str]]:
    """Fetch article URL, extract plain-text paragraphs, group into ~500-char chunks."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
        resp = await client.get(url, headers=_HEADERS)
        resp.raise_for_status()
        html = resp.text

    soup = BeautifulSoup(html, "html.parser")

    og = soup.find("meta", property="og:title")
    title = (og.get("content", "") if og else "") or (soup.title.string if soup.title else "") or ""
    title = title.strip()

    for tag in soup(_NOISE_TAGS):
        tag.decompose()

    content = (
        soup.find("div", class_=lambda c: c and any(x in c for x in ("article-content", "post-content", "entry-content", "article__content", "article__body")))
        or soup.find("article")
        or soup.find("main")
        or soup.find("div", {"role": "main"})
        or soup.body
    )
    if not content:
        return title, []

    raw_blocks = [
        el.get_text(" ", strip=True)
        for el in content.find_all(["p", "h1", "h2", "h3", "h4", "li", "blockquote"])
        if len(el.get_text(strip=True)) > 40
    ]

    chunks: list[str] = []
    current = ""
    for block in raw_blocks:
        if current and len(current) + 1 + len(block) > 500:
            chunks.append(current)
            current = block
        else:
            current = (current + " " + block).strip() if current else block
    if current:
        chunks.append(current)

    return title, chunks


async def _rag_article_chunks(url: str, query: str, k: int = 8) -> list[dict]:
    """Chunk article via fresh fetch, embed, return top-k chunks ranked by relevance."""
    if url not in _article_chunk_cache:
        try:
            _article_chunk_cache[url] = await _fetch_and_chunk_article(url)
        except Exception as e:
            logger.warning("Failed to fetch/chunk article %s: %s", url, e)
            return []

    title, chunks = _article_chunk_cache[url]
    if not chunks:
        return []

    embeddings = OpenAIEmbeddings(model="text-embedding-3-small", api_key=settings.openai_api_key)
    query_emb, chunk_embs = await asyncio.gather(
        embeddings.aembed_query(query),
        embeddings.aembed_documents(chunks),
    )

    scores = [_cosine_sim(query_emb, ce) for ce in chunk_embs]
    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    top_indices.sort()  # preserve reading order

    return [
        {"id": str(rank + 1), "url": url, "title": title, "source": "article", "text": chunks[idx]}
        for rank, idx in enumerate(top_indices)
    ]


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
            """You are a business intelligence analyst. Answer questions using ONLY the provided numbered article passages.
Include inline citations like [1], [2] after every factual claim — use the number of the passage the claim comes from.
Be specific and concise. Only assert what the passages directly support.""",
        ),
        (
            "human",
            """Article: {title}

Passages:
{sources_text}

Question: {query}

Answer with inline citations:""",
        ),
    ]
)


# ---------------------------------------------------------------------------
# Article RAG (non-streaming, for evaluation)
# ---------------------------------------------------------------------------

async def run_article_rag(article_url: str, query: str, k: int = 8, use_advanced_retriever: bool = False) -> tuple[str, list[str]]:
    """
    Run article RAG for a single query: fetch/chunk article, retrieve top-k passages,
    generate answer. Returns (response_text, list of retrieved context strings) for RAGAS.
    """
    chunks = await _rag_article_chunks(article_url, query, k=k)
    if not chunks:
        return "", []

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        streaming=False,
        temperature=0,
    )

    # "Advanced retriever" for article eval: rerank the already-fetched/chunked
    # article passages using Cohere.
    if use_advanced_retriever:
        compressor = _get_cohere_compressor(k)
        if compressor is not None:
            try:
                from langchain_core.documents import Document

                docs_for_rerank = [
                    Document(
                        page_content=c["text"],
                        metadata={
                            "id": c.get("id"),
                            "url": c.get("url", ""),
                            "title": c.get("title", ""),
                            "source": c.get("source", "article"),
                        },
                    )
                    for c in chunks
                ]
                reranked_docs = await compressor.acompress_documents(docs_for_rerank, query)
                if reranked_docs:
                    chunks = [
                        {
                            "id": str(d.metadata.get("id") or i + 1),
                            "url": d.metadata.get("url", article_url),
                            "title": d.metadata.get("title", chunks[0].get("title", "")),
                            "source": d.metadata.get("source", "article"),
                            "text": d.page_content,
                        }
                        for i, d in enumerate(reranked_docs)
                    ]
            except Exception as e:
                logger.warning("Cohere rerank failed; falling back to cosine top-k: %s", e)

    sources_text = "\n\n".join(f"[{c['id']}] {c['text']}" for c in chunks)
    context_list = [c["text"] for c in chunks]

    chain = ARTICLE_CHAT_PROMPT | llm
    response = await chain.ainvoke(
        {
            "title": chunks[0]["title"],
            "sources_text": sources_text,
            "query": query,
        }
    )
    answer = response.content if hasattr(response, "content") else str(response)
    return answer, context_list


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
        yield _sse("status", {"message": "Chunking article..."})
        await asyncio.sleep(0)

        chunks = await _rag_article_chunks(article_url, query)

        if chunks:
            sources_text = "\n\n".join(
                f"[{c['id']}] {c['text']}" for c in chunks
            )
            yield _sse("status", {"message": "Generating cited answer..."})
            await asyncio.sleep(0)

            chain = ARTICLE_CHAT_PROMPT | llm
            async for chunk in chain.astream(
                {
                    "title": chunks[0]["title"],
                    "sources_text": sources_text,
                    "query": query,
                }
            ):
                if chunk.content:
                    yield _sse("token", {"text": chunk.content})

            yield _sse("sources", {"sources": chunks})
            yield _sse("done", {"message": "Complete"})
            return

        # Chunks not found in store — fall through
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


# ---------------------------------------------------------------------------
# Article reader
# ---------------------------------------------------------------------------

_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; bd-agent/1.0)"}
_NOISE_TAGS = ["script", "style", "noscript", "iframe", "nav", "footer", "header",
               "aside", "form", "figure.related", "div.related", "button"]


def _absolute_urls(tag_name: str, attr: str, soup: BeautifulSoup, base: str) -> None:
    for el in soup.find_all(tag_name, **{attr: True}):
        val = el[attr]
        if val.startswith(("http://", "https://", "data:", "//")):
            continue
        el[attr] = urljoin(base, val)


@router.get("/article-content")
async def get_article_content(url: str = Query(...)):
    """Fetch an article URL and return cleaned, readable HTML."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(400, "Invalid URL")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15) as client:
            resp = await client.get(url, headers=_HEADERS)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPStatusError as e:
        raise HTTPException(e.response.status_code, f"Could not fetch article: {e}")
    except Exception as e:
        raise HTTPException(502, f"Could not fetch article: {e}")

    soup = BeautifulSoup(html, "html.parser")

    # Extract title from og:title or <title>
    og = soup.find("meta", property="og:title")
    title = (og.get("content", "") if og else "") or (soup.title.string if soup.title else "") or ""

    # Extract og:image for hero
    og_img = soup.find("meta", property="og:image")
    hero_image = og_img.get("content", "") if og_img else ""

    # Remove noise elements
    for tag in soup(_NOISE_TAGS):
        tag.decompose()

    # Find the main article body — try progressively broader selectors
    content = (
        soup.find("div", class_=lambda c: c and any(x in c for x in ("article-content", "post-content", "entry-content", "article__content", "article__body")))
        or soup.find("article")
        or soup.find("main")
        or soup.find("div", {"role": "main"})
        or soup.body
    )

    if not content:
        raise HTTPException(422, "Could not extract article content")

    # Make image src and anchor href absolute
    _absolute_urls("img", "src", content, url)
    _absolute_urls("a", "href", content, url)

    # Open all links in a new tab
    for a in content.find_all("a", href=True):
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"

    return {"title": title.strip(), "hero_image": hero_image, "html": str(content)}
