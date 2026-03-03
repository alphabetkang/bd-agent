"""Report export endpoint."""
import logging
from datetime import datetime

from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/reports", tags=["reports"])


class CompanyEntry(BaseModel):
    name: str
    context: str
    source: str = ""
    url: str = ""


class ReportRequest(BaseModel):
    query: str
    companies: list[CompanyEntry]
    answer: str = ""


def _build_markdown_report(req: ReportRequest) -> str:
    now = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        f"# Business Intelligence Report",
        f"",
        f"**Query:** {req.query}",
        f"**Generated:** {now}",
        f"**Companies Identified:** {len(req.companies)}",
        f"",
        f"---",
        f"",
        f"## Summary",
        f"",
        req.answer if req.answer else "_No summary available._",
        f"",
        f"---",
        f"",
        f"## Companies",
        f"",
    ]

    for i, company in enumerate(req.companies, start=1):
        lines.append(f"### {i}. {company.name}")
        lines.append(f"")
        lines.append(f"**Relevance:** {company.context}")
        if company.source:
            lines.append(f"")
            lines.append(f"**Source:** {company.source}")
        if company.url:
            lines.append(f"")
            lines.append(f"**Link:** [{company.url}]({company.url})")
        lines.append(f"")
        lines.append(f"---")
        lines.append(f"")

    return "\n".join(lines)


@router.post("/export")
async def export_report(req: ReportRequest):
    """Generate and return a markdown report as a downloadable file."""
    content = _build_markdown_report(req)
    slug = req.query[:40].replace(" ", "_").replace("/", "-")
    filename = f"report_{slug}.md"
    return Response(
        content=content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
