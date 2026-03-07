"""Fetches RSS feeds and ingests articles into the vector store."""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

import feedparser
import httpx
from bs4 import BeautifulSoup
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter

from config import RSS_FEEDS
from ingestion.vector_store import get_vector_store

logger = logging.getLogger(__name__)

_splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=80)

# If the RSS body is shorter than this we assume it's a summary and try to
# fetch the full article text from the article URL.
_SUMMARY_THRESHOLD = 500


def _fetch_feed_content(url: str) -> bytes:
    """Fetch raw feed bytes via httpx (handles SSL properly on macOS)."""
    with httpx.Client(follow_redirects=True, timeout=15) as client:
        resp = client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; bd-agent/1.0)"})
        resp.raise_for_status()
        return resp.content


def _fetch_full_text(url: str) -> str | None:
    """Fetch a news article URL and return its main body text, or None on failure."""
    if not url:
        return None
    try:
        with httpx.Client(follow_redirects=True, timeout=8) as client:
            resp = client.get(
                url, headers={"User-Agent": "Mozilla/5.0 (compatible; bd-agent/1.0)"}
            )
            resp.raise_for_status()
            raw = resp.content
        soup = BeautifulSoup(raw, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator="\n", strip=True)
        return text or None
    except Exception as exc:
        logger.debug("Could not fetch full text for %s: %s", url, exc)
        return None


def _build_entry_docs(
    title: str,
    body: str,
    link: str,
    published: str,
    feed_name: str,
) -> list[Document]:
    """
    Build Documents for a single RSS entry.

    If the RSS body looks like a short summary (below the threshold), fetch the
    full article text and chunk it.  Fall back to the summary on any failure.
    """
    metadata = {
        "source": feed_name,
        "url": link,
        "title": title,
        "published": published,
        "ingested_at": datetime.utcnow().isoformat(),
    }

    # Strip any HTML that some feeds embed in the summary/content field
    if "<" in body:
        body = BeautifulSoup(body, "html.parser").get_text(separator="\n", strip=True)

    full_text: str | None = None
    if len(body) < _SUMMARY_THRESHOLD and link:
        full_text = _fetch_full_text(link)

    if full_text and len(full_text) > len(body):
        logger.debug("Using full article text for '%s' (%d chars)", title, len(full_text))
        raw_text = f"{title}\n\n{full_text}"
        return _splitter.create_documents([raw_text], metadatas=[metadata])

    # Fallback: use whatever the RSS feed provided (summary or partial content)
    logger.debug("Using RSS body for '%s' (%d chars)", title, len(body))
    return [Document(page_content=f"{title}\n\n{body}".strip(), metadata=metadata)]


def _parse_feed(feed_config: dict) -> list[tuple[str, str, str, str, str]]:
    """
    Parse a single RSS feed.

    Returns a list of (title, body, link, published, feed_name) tuples — one
    per entry — ready for document building.
    """
    entries: list[tuple[str, str, str, str, str]] = []
    try:
        raw = _fetch_feed_content(feed_config["url"])
        feed = feedparser.parse(raw)
        for entry in feed.entries:
            title = entry.get("title", "")
            summary = entry.get("summary", "")
            content_list = entry.get("content", [])
            content = content_list[0].get("value", "") if content_list else ""
            body = content or summary
            if not title and not body:
                continue
            link = entry.get("link", "")
            published = entry.get("published", "")
            entries.append((title, body, link, published, feed_config["name"]))
    except Exception as exc:
        logger.error("Failed to parse feed %s: %s", feed_config["name"], exc)
    return entries


def ingest_all_feeds() -> int:
    """Fetch all configured RSS feeds and upsert into the vector store."""
    logger.info("Starting RSS ingestion for %d feeds", len(RSS_FEEDS))

    # Step 1: Parse every feed (fast — just downloads the XML)
    all_entries: list[tuple[str, str, str, str, str]] = []
    for feed_config in RSS_FEEDS:
        entries = _parse_feed(feed_config)
        logger.info("  %s: %d entries parsed", feed_config["name"], len(entries))
        all_entries.extend(entries)

    if not all_entries:
        logger.warning("No articles fetched from any feed")
        return 0

    # Step 2: Build documents, fetching full article text concurrently where needed
    all_docs: list[Document] = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_entry = {
            executor.submit(_build_entry_docs, *entry): entry
            for entry in all_entries
        }
        for future in as_completed(future_to_entry):
            entry = future_to_entry[future]
            try:
                docs = future.result()
                all_docs.extend(docs)
            except Exception as exc:
                logger.error("Failed to build docs for %s: %s", entry[2], exc)

    if not all_docs:
        logger.warning("No documents built from feed entries")
        return 0

    # Step 3: Generate stable IDs for deduplication.
    # The first chunk of each article keeps the article URL as its ID (preserving
    # existing stored entries).  Additional chunks get a numeric suffix.
    url_chunk_count: dict[str, int] = {}
    ids: list[str] = []
    for doc in all_docs:
        url = doc.metadata.get("url", "")
        n = url_chunk_count.get(url, 0)
        ids.append(url if n == 0 else f"{url}__c{n}")
        url_chunk_count[url] = n + 1

    store = get_vector_store()
    store.add_documents(all_docs, ids=ids)
    logger.info(
        "Ingested %d chunks from %d articles into vector store",
        len(all_docs),
        len(all_entries),
    )
    return len(all_docs)
