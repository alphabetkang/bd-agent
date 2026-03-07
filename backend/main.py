"""FastAPI application entry point."""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.articles import router as articles_router
from api.chat import router as chat_router
from api.company import router as company_router
from api.feeds import router as feeds_router
from api.reports import router as reports_router
from api.sources import router as sources_router
from config import settings
from ingestion.rss_ingester import ingest_all_feeds

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="BD Agent API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(articles_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(company_router, prefix="/api")
app.include_router(feeds_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(sources_router, prefix="/api")

scheduler = AsyncIOScheduler()


@app.on_event("startup")
async def startup():
    # Initial RSS ingest
    logger.info("Running initial RSS ingestion...")
    try:
        count = ingest_all_feeds()
        logger.info("Initial ingestion complete: %d articles", count)
    except Exception as exc:
        logger.error("Initial ingestion failed: %s", exc)

    # Schedule periodic refresh
    scheduler.add_job(
        ingest_all_feeds,
        "interval",
        minutes=settings.rss_refresh_interval_minutes,
        id="rss_refresh",
    )
    scheduler.start()
    logger.info(
        "RSS refresh scheduled every %d minutes",
        settings.rss_refresh_interval_minutes,
    )


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown()


@app.get("/health")
async def health():
    return {"status": "ok"}
