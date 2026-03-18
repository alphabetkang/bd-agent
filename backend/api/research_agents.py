"""Research agent endpoint — similarity search against the vector store."""
import asyncio
import logging

from fastapi import APIRouter
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from api.articles import _extract_companies, _load_cache, _save_cache
from config import settings
from ingestion.vector_store import get_vector_store

router = APIRouter(prefix="/research-agents", tags=["research-agents"])
logger = logging.getLogger(__name__)


class SearchRequest(BaseModel):
    prompt: str


async def _generate_name(prompt: str) -> str:
    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )
    try:
        response = await llm.ainvoke(
            f"Summarise this research topic in 3–4 words as a short title. "
            f"Return only the title, no punctuation, no quotes.\n\nTopic: {prompt}"
        )
        return response.content.strip()
    except Exception:
        return prompt[:40]


async def _generate_summary(prompt: str, articles: list[dict]) -> str:
    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.3,
    )
    articles_text = "\n".join(
        f"- {a['title']} ({a['source']}): {a['snippet']}"
        for a in articles[:12]
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a business development analyst. Write a concise executive summary "
                "of the following news articles as they relate to the research topic. "
                "Maximum 5 sentences. Be specific, focus on key trends and notable developments."
            ),
        },
        {
            "role": "user",
            "content": f"Research topic: {prompt}\n\nArticles:\n{articles_text}",
        },
    ]
    try:
        response = await llm.ainvoke(messages)
        return response.content.strip()
    except Exception as exc:
        logger.error("Summary generation failed: %s", exc)
        return ""


@router.post("/search")
async def search_articles(req: SearchRequest):
    """Return articles and an executive summary for the research prompt."""
    store = get_vector_store()
    docs = store.similarity_search(req.prompt, k=20)

    # Deduplicate by URL, use first matching chunk as snippet
    seen: dict[str, dict] = {}
    for doc in docs:
        meta = doc.metadata
        url = meta.get("url", "")
        if not url or url in seen:
            continue
        source = meta.get("source", "")
        if not source:
            continue
        snippet = doc.page_content.strip()
        title = meta.get("title", "")
        if title and snippet.startswith(title):
            snippet = snippet[len(title):].strip()
        seen[url] = {
            "url": url,
            "title": title,
            "published": meta.get("published", ""),
            "source": source,
            "snippet": snippet[:220].strip(),
            "companies": [],
        }

    if not seen:
        return {"articles": [], "summary": ""}

    cache = _load_cache()
    cache_updated = False

    for url, article in seen.items():
        if url in cache:
            article["companies"] = cache[url]
        else:
            companies = await _extract_companies(article["title"])
            article["companies"] = companies
            cache[url] = companies
            cache_updated = True

    if cache_updated:
        _save_cache(cache)

    articles = list(seen.values())
    summary, name = await asyncio.gather(
        _generate_summary(req.prompt, articles),
        _generate_name(req.prompt),
    )

    return {"articles": articles, "summary": summary, "name": name}
