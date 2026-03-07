"""SSE streaming chat endpoint."""
import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.graph import research_graph
from agents.state import ResearchState

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    query: str


def _sse(event_type: str, data: dict | str) -> str:
    """Format a single SSE message."""
    return f"data: {json.dumps({'type': event_type, 'content': data})}\n\n"


async def _stream_research(query: str) -> AsyncGenerator[str, None]:
    """Run the research graph and stream events back to the client."""

    # --- status: starting ---
    yield _sse("status", {"message": "Retrieving from news archive..."})
    await asyncio.sleep(0)  # yield to event loop

    initial_state: ResearchState = {
        "query": query,
        "messages": [],
        "rag_context": "",
        "source_docs": [],
        "web_context": "",
        "web_source_docs": [],
        "final_answer": "",
        "companies": [],
    }

    final_state: ResearchState | None = None

    # Stream graph execution events
    async for event in research_graph.astream_events(
        initial_state, version="v2"
    ):
        kind = event["event"]
        name = event.get("name", "")

        # Status updates at node boundaries
        node = event.get("metadata", {}).get("langgraph_node", "")
        if kind == "on_chain_start" and node:
            if node == "web_search":
                yield _sse("status", {"message": "Searching the web..."})
            elif node == "synthesis":
                yield _sse("status", {"message": "Analysing results..."})
            elif node == "company_extraction":
                yield _sse("status", {"message": "Identifying companies..."})

        # Stream LLM tokens
        elif kind == "on_chat_model_stream":
            chunk = event["data"].get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                yield _sse("token", {"text": chunk.content})

        # Capture the final graph output
        elif kind == "on_chain_end" and name == "LangGraph":
            final_state = event["data"].get("output")

    # Send companies and all source docs (RAG + web) after the stream completes
    if final_state and final_state.get("companies"):
        yield _sse("companies", {"companies": final_state["companies"]})
    all_sources = (final_state or {}).get("source_docs", []) + (final_state or {}).get("web_source_docs", [])
    if all_sources:
        yield _sse("sources", {"sources": all_sources})

    yield _sse("done", {"message": "Complete"})


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    return StreamingResponse(
        _stream_research(request.query),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
