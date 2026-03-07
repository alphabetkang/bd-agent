"""Individual agent nodes for the LangGraph research pipeline."""
import json
import logging
import re

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from tavily import TavilyClient

from agents.state import CompanyResult, ResearchState
from config import settings
from ingestion.vector_store import get_retriever

logger = logging.getLogger(__name__)


def _get_llm(streaming: bool = False) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.openai_model,
        api_key=settings.openai_api_key,
        streaming=streaming,
        temperature=0,
    )


# ---------------------------------------------------------------------------
# Node 1: RAG retrieval
# ---------------------------------------------------------------------------

def rag_retrieval_node(state: ResearchState) -> dict:
    """Retrieve relevant passages from the news vector store."""
    retriever = get_retriever(k=6)
    docs = retriever.invoke(state["query"])

    if not docs:
        return {
            "rag_context": "No relevant articles found in the news archive.",
            "source_docs": [],
        }

    passages = []
    source_docs = []
    for i, doc in enumerate(docs):
        source = doc.metadata.get("source", "Unknown")
        title = doc.metadata.get("title", "")
        url = doc.metadata.get("url", "")
        text = doc.page_content[:800]
        passages.append(f"[{source}] {title}\nURL: {url}\n{text}")
        source_docs.append({
            "id": str(i + 1),
            "title": title,
            "url": url,
            "source": source,
            "text": doc.page_content,
        })

    context = "\n\n---\n\n".join(passages)
    logger.info("RAG retrieved %d documents", len(docs))
    return {"rag_context": context, "source_docs": source_docs}


# ---------------------------------------------------------------------------
# Node 2: Web search via Tavily
# ---------------------------------------------------------------------------

# def web_search_node(state: ResearchState) -> dict:
#     """Search the web for up-to-date information using Tavily."""
#     try:
#         client = TavilyClient(api_key=settings.tavily_api_key)
#         results = client.search(
#             query=state["query"],
#             search_depth="advanced",
#             max_results=5,
#         )
#         passages = []
#         web_source_docs = []
#         rag_count = len(state.get("source_docs", []))
#         for i, r in enumerate(results.get("results", [])):
#             title = r.get("title", "")
#             url = r.get("url", "")
#             content = r.get("content", "")
#             passages.append(f"[{title}]\nURL: {url}\n{content[:600]}")
#             web_source_docs.append({
#                 "id": str(rag_count + i + 1),
#                 "title": title,
#                 "url": url,
#                 "source": "Web Search",
#                 "text": content,
#             })
#         context = "\n\n---\n\n".join(passages)
#         logger.info("Tavily returned %d results", len(passages))
#         return {"web_context": context, "web_source_docs": web_source_docs}
#     except Exception as exc:
#         logger.error("Tavily search failed: %s", exc)
#         return {"web_context": "Web search unavailable.", "web_source_docs": []}


# ---------------------------------------------------------------------------
# Node 3: Synthesis — produces the streaming-friendly final answer
# ---------------------------------------------------------------------------

SYNTHESIS_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a business intelligence analyst. Using the provided news context and web search results,
answer the user's query thoroughly and concisely. Focus on facts, trends, and company-specific insights.
If you mention companies, be specific about why they are relevant to the query.
Format your answer in clear paragraphs. Do NOT include JSON in your response — that is handled separately.""",
        ),
        (
            "human",
            """Query: {query}

--- NEWS ARCHIVE CONTEXT ---
{rag_context}

--- WEB SEARCH RESULTS ---
{web_context}

Provide a comprehensive answer:""",
        ),
    ]
)


async def synthesis_node(state: ResearchState) -> dict:
    """Synthesise the final answer from RAG + web context."""
    llm = _get_llm(streaming=True)
    chain = SYNTHESIS_PROMPT | llm
    response = await chain.ainvoke(
        {
            "query": state["query"],
            "rag_context": state["rag_context"],
            "web_context": state["web_context"],
        }
    )
    answer = response.content
    return {
        "final_answer": answer,
        "messages": [HumanMessage(content=state["query"]), AIMessage(content=answer)],
    }


# ---------------------------------------------------------------------------
# Node 4: Company extraction — structured output
# ---------------------------------------------------------------------------

COMPANY_EXTRACTION_PROMPT = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are an expert at identifying companies mentioned in business intelligence reports.
Extract all companies mentioned in the provided answer that are relevant to the user's query.
Return ONLY a valid JSON array — no markdown, no explanation. Each object must have:
  - "name": company name (string)
  - "context": one sentence explaining why this company is relevant to the query (string)
  - "source": the news source it was found in, or "Web Search" (string)
  - "url": the direct URL of the article or page where this company is mentioned (string).

If no companies are found, return an empty array: []""",
        ),
        (
            "human",
            """Query: {query}

Answer: {final_answer}

News context:
{rag_context}

Web context:
{web_context}

Return the JSON array of companies:""",
        ),
    ]
)


async def company_extraction_node(state: ResearchState) -> dict:
    """Extract structured company data from the synthesised answer."""
    llm = _get_llm(streaming=False)
    chain = COMPANY_EXTRACTION_PROMPT | llm
    response = await chain.ainvoke(
        {
            "query": state["query"],
            "final_answer": state["final_answer"],
            "rag_context": state["rag_context"][:2000],
            "web_context": state["web_context"][:2000],
        }
    )

    raw = response.content.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        companies: list[CompanyResult] = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Could not parse company extraction JSON: %s", raw[:200])
        companies = []

    return {"companies": companies}
