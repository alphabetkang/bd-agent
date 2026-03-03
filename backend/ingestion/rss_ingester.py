"""Fetches RSS feeds and ingests articles into the vector store."""
import logging
from datetime import datetime

import feedparser
import httpx
from langchain_core.documents import Document

from config import RSS_FEEDS
from ingestion.vector_store import get_vector_store

logger = logging.getLogger(__name__)


def _fetch_feed_content(url: str) -> bytes:
    """Fetch raw feed bytes via httpx (handles SSL properly on macOS)."""
    with httpx.Client(follow_redirects=True, timeout=15) as client:
        resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; bd-agent/1.0)"})
        resp.raise_for_status()
        return resp.content


def _parse_feed(feed_config: dict) -> list[Document]:
    """Parse a single RSS feed into LangChain Documents."""
    docs: list[Document] = []
    try:
        raw = _fetch_feed_content(feed_config["url"])
        feed = feedparser.parse(raw)
        for entry in feed.entries:
            # Build the full text from title + summary/content
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            content_list = entry.get("content", [])
            content = content_list[0].get("value", "") if content_list else ""
            body = content or summary

            text = f"{title}\n\n{body}".strip()
            if not text:
                continue

            published = entry.get("published", "")
            link = entry.get("link", "")

            docs.append(
                Document(
                    page_content=text,
                    metadata={
                        "source": feed_config["name"],
                        "url": link,
                        "title": title,
                        "published": published,
                        "ingested_at": datetime.utcnow().isoformat(),
                    },
                )
            )
    except Exception as exc:
        logger.error("Failed to parse feed %s: %s", feed_config["name"], exc)
    return docs


def ingest_all_feeds() -> int:
    """Fetch all configured RSS feeds and upsert into the vector store."""
    logger.info("Starting RSS ingestion for %d feeds", len(RSS_FEEDS))
    all_docs: list[Document] = []
    for feed_config in RSS_FEEDS:
        docs = _parse_feed(feed_config)
        logger.info("  %s: %d articles", feed_config["name"], len(docs))
        all_docs.extend(docs)

    if not all_docs:
        logger.warning("No articles fetched from any feed")
        return 0

    store = get_vector_store()
    # Use URL as ID to avoid duplicates
    ids = [doc.metadata.get("url", str(i)) for i, doc in enumerate(all_docs)]
    store.add_documents(all_docs, ids=ids)
    logger.info("Ingested %d total articles into vector store", len(all_docs))
    return len(all_docs)
