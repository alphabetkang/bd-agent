"""LangGraph state definition shared across all agent nodes."""
from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class CompanyResult(TypedDict):
    name: str
    context: str
    source: str
    url: str


class SourceDoc(TypedDict):
    id: str
    title: str
    url: str
    source: str
    text: str


class ResearchState(TypedDict):
    # The user's original query
    query: str
    # Accumulated message history
    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Raw retrieved passages from the vector store
    rag_context: str
    # Structured source docs returned from RAG (for the article viewer)
    source_docs: list[SourceDoc]
    # Raw results from Tavily web search
    web_context: str
    # Structured source docs from Tavily web search (for the article viewer)
    web_source_docs: list[SourceDoc]
    # Final synthesised answer text
    final_answer: str
    # Extracted companies with their relevance context
    companies: list[CompanyResult]
