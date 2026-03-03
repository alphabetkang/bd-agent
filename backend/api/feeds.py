"""Feeds management endpoints."""
import logging

from fastapi import APIRouter

from ingestion.rss_ingester import ingest_all_feeds

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feeds", tags=["feeds"])


@router.post("/refresh")
async def refresh_feeds():
    """Manually trigger an RSS re-ingest."""
    try:
        count = ingest_all_feeds()
        return {"status": "ok", "articles_ingested": count}
    except Exception as exc:
        logger.error("Manual refresh failed: %s", exc)
        return {"status": "error", "message": str(exc)}
