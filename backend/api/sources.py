"""User-managed data sources — add URLs, upload files, list, delete."""
import json
import logging
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from ingestion.source_processor import delete_source, process_file, process_url

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/sources", tags=["sources"])

SOURCES_FILE = Path(__file__).parent.parent / "user_sources.json"
MAX_UPLOAD_MB = 20


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------

def _load() -> list[dict]:
    if not SOURCES_FILE.exists():
        return []
    try:
        return json.loads(SOURCES_FILE.read_text())
    except Exception:
        return []


def _save(sources: list[dict]) -> None:
    SOURCES_FILE.write_text(json.dumps(sources, indent=2))


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AddUrlRequest(BaseModel):
    url: str
    name: str = ""


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
async def list_sources():
    return _load()


@router.post("/url")
async def add_url_source(req: AddUrlRequest):
    url = req.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL must start with http:// or https://")

    source_id = str(uuid.uuid4())
    name = req.name.strip() or url

    try:
        count = process_url(url, source_id, name)
    except Exception as exc:
        raise HTTPException(422, str(exc))

    entry = {
        "id": source_id,
        "name": name,
        "type": "url",
        "url": url,
        "added_at": datetime.utcnow().isoformat(),
        "chunk_count": count,
    }
    sources = _load()
    sources.append(entry)
    _save(sources)
    logger.info("Added URL source '%s' (%d chunks)", name, count)
    return entry


@router.post("/upload")
async def upload_source(file: UploadFile = File(...)):
    filename = file.filename or "upload"
    content = await file.read()

    if len(content) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"File exceeds {MAX_UPLOAD_MB} MB limit.")

    source_id = str(uuid.uuid4())

    try:
        count = process_file(filename, content, source_id)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    except Exception as exc:
        raise HTTPException(500, f"Processing failed: {exc}")

    entry = {
        "id": source_id,
        "name": filename,
        "type": _file_type(filename),
        "url": None,
        "added_at": datetime.utcnow().isoformat(),
        "chunk_count": count,
    }
    sources = _load()
    sources.append(entry)
    _save(sources)
    logger.info("Uploaded source '%s' (%d chunks)", filename, count)
    return entry


@router.delete("/{source_id}")
async def remove_source(source_id: str):
    sources = _load()
    entry = next((s for s in sources if s["id"] == source_id), None)
    if not entry:
        raise HTTPException(404, "Source not found.")

    try:
        delete_source(source_id)
    except Exception as exc:
        logger.warning("Vector store cleanup failed for %s: %s", source_id, exc)

    _save([s for s in sources if s["id"] != source_id])
    return {"deleted": source_id}


def _file_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        return "pdf"
    if lower.endswith(".docx"):
        return "docx"
    return "file"
