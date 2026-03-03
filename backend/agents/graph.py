"""LangGraph multi-agent research pipeline."""
from langgraph.graph import END, StateGraph

from agents.nodes import (
    company_extraction_node,
    rag_retrieval_node,
    synthesis_node,
    web_search_node,
)
from agents.state import ResearchState


def build_research_graph():
    """Build and compile the research graph.

    Pipeline:
        rag_retrieval
             |
        web_search
             |
         synthesis
             |
      company_extraction
             |
            END
    """
    graph = StateGraph(ResearchState)

    graph.add_node("rag_retrieval", rag_retrieval_node)
    graph.add_node("web_search", web_search_node)
    graph.add_node("synthesis", synthesis_node)
    graph.add_node("company_extraction", company_extraction_node)

    graph.set_entry_point("rag_retrieval")
    graph.add_edge("rag_retrieval", "web_search")
    graph.add_edge("web_search", "synthesis")
    graph.add_edge("synthesis", "company_extraction")
    graph.add_edge("company_extraction", END)

    return graph.compile()


# Module-level compiled graph (initialised once on startup)
research_graph = build_research_graph()
