"""Overview endpoint — LLM-powered company shortlisting."""
import json
import logging
from pathlib import Path

from fastapi import APIRouter
from langchain_openai import ChatOpenAI
from pydantic import BaseModel

from config import settings
from ingestion.vector_store import get_vector_store

router = APIRouter(prefix="/overview", tags=["overview"])
logger = logging.getLogger(__name__)

COMPANY_CACHE_FILE = Path(__file__).parent.parent / "article_companies.json"


def _load_company_cache() -> dict:
    if COMPANY_CACHE_FILE.exists():
        try:
            return json.loads(COMPANY_CACHE_FILE.read_text())
        except Exception:
            return {}
    return {}


class TopCompaniesRequest(BaseModel):
    interests: list[str]


@router.post("/top-companies")
async def top_companies(req: TopCompaniesRequest):
    """
    Given a list of research interest strings (agent prompts), return 5 companies
    most strategically relevant to those interests, with a short rationale for each.
    """
    if not req.interests:
        return []

    store = get_vector_store()
    cache = _load_company_cache()

    # Collect relevant articles across all interests via similarity search
    seen_urls: set[str] = set()
    company_articles: dict[str, list[str]] = {}  # company -> [article titles]

    for interest in req.interests:
        docs = store.similarity_search(interest, k=10)
        for doc in docs:
            url = doc.metadata.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            title = doc.metadata.get("title", "")
            companies = cache.get(url, [])
            for company in companies:
                if company not in company_articles:
                    company_articles[company] = []
                if title and title not in company_articles[company]:
                    company_articles[company].append(title)

    if not company_articles:
        return []

    # Build context: sort by frequency (most-mentioned first), take top 30
    sorted_companies = sorted(
        company_articles.items(), key=lambda x: len(x[1]), reverse=True
    )[:30]

    companies_context = "\n".join(
        f"- {name} (mentioned in {len(titles)} article{'s' if len(titles) != 1 else ''}): "
        + "; ".join(titles[:3])
        for name, titles in sorted_companies
    )
    interests_text = "\n".join(f"- {i}" for i in req.interests)

    llm = ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        temperature=0.2,
    )
    messages = [
        {
            "role": "system",
            "content": (
                "You are a business development analyst. "
                "Select the 5 most strategically relevant companies for the user based on their "
                "research interests and the companies appearing in related news. "
                "Return ONLY a JSON array of exactly 5 objects with 'name' (string) and "
                "'rationale' (1-2 sentence string) fields. No markdown, no explanation."
            ),
        },
        {
            "role": "user",
            "content": (
                f"User's research interests:\n{interests_text}\n\n"
                f"Companies in relevant articles:\n{companies_context}"
            ),
        },
    ]

    try:
        response = await llm.ainvoke(messages)
        raw = response.content.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        result = json.loads(raw.strip())
        return [
            {"name": str(r["name"]), "rationale": str(r["rationale"])}
            for r in result
            if "name" in r and "rationale" in r
        ][:5]
    except Exception as exc:
        logger.error("Top companies generation failed: %s", exc)
        return []
