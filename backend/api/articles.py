"""Article listing endpoint — reads ingested articles from Chroma."""
import json
import logging
from pathlib import Path

from fastapi import APIRouter
from langchain_openai import ChatOpenAI

from config import RSS_FEEDS, settings
from ingestion.vector_store import get_vector_store

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/articles", tags=["articles"])

COMPANY_CACHE_FILE = Path(__file__).parent.parent / "article_companies.json"
PINNED_ARTICLE_FILE = Path(__file__).parent.parent / "evaluation" / "pinned_article.json"


def _load_cache() -> dict:
    if COMPANY_CACHE_FILE.exists():
        try:
            return json.loads(COMPANY_CACHE_FILE.read_text())
        except Exception:
            return {}
    return {}


def _save_cache(cache: dict) -> None:
    COMPANY_CACHE_FILE.write_text(json.dumps(cache, indent=2))


async def _extract_companies(title: str) -> list[str]:
    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0,
    )
    prompt = (
        "Extract the main company or companies mentioned in this tech article title. "
        "Return ONLY a JSON array of strings (max 3 names). No markdown, no explanation.\n\n"
        f"Title: {title}"
    )
    try:
        response = await llm.ainvoke(prompt)
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return [str(c) for c in result if c][:3]
    except Exception:
        return []


@router.get("")
async def list_articles():
    """Return all ingested RSS feed articles, deduplicated and tagged with companies."""
    rss_source_names = [f["name"] for f in RSS_FEEDS]
    try:
        collection = get_vector_store()._collection
        results = collection.get(
            where={"source": {"$in": rss_source_names}},
            include=["metadatas", "documents"],
        )
    except Exception as exc:
        logger.error("Chroma query failed: %s", exc)
        return []

    metadatas = results.get("metadatas") or []
    documents = results.get("documents") or []

    # One entry per unique article URL; use first chunk as snippet
    seen: dict[str, dict] = {}
    for meta, doc in zip(metadatas, documents):
        url = meta.get("url", "")
        if not url or url in seen:
            continue
        # Strip leading title repetition from snippet
        snippet = doc.strip()
        title = meta.get("title", "")
        if title and snippet.startswith(title):
            snippet = snippet[len(title):].strip()
        seen[url] = {
            "url": url,
            "title": title,
            "published": meta.get("published", ""),
            "source": meta.get("source", "TechCrunch"),
            "snippet": snippet[:220].strip(),
            "companies": [],
        }

    if not seen:
        return []

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
            logger.debug("Extracted companies for %s: %s", url, companies)

    if cache_updated:
        _save_cache(cache)

    articles = list(seen.values())
    articles.sort(key=lambda a: a["published"], reverse=True)

    # Prepend the pinned evaluation article if it exists
    if PINNED_ARTICLE_FILE.exists():
        try:
            pinned = json.loads(PINNED_ARTICLE_FILE.read_text())
            # Remove it from the regular list if it was ingested (avoid duplicate)
            articles = [a for a in articles if a["url"] != pinned.get("url")]
            articles.insert(0, pinned)
        except Exception as e:
            logger.warning("Could not load pinned article: %s", e)

    return articles
