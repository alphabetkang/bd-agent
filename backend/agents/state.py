"""LangGraph state definition shared across all agent nodes."""
from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class CompanyResult(TypedDict):
    name: str
    context: str
    source: str
    url: str


class ResearchState(TypedDict):
    # The user's original query
    query: str
    # Accumulated message history
    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Raw retrieved passages from the vector store
    rag_context: str
    # Raw results from Tavily web search
    web_context: str
    # Final synthesised answer text
    final_answer: str
    # Extracted companies with their relevance context
    companies: list[CompanyResult]
