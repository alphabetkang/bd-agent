import asyncio
import re
import sys
from pathlib import Path

# Allow importing backend modules (e.g. config) when run as script
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

from langchain_community.document_loaders import TextLoader
from ragas.llms import LangchainLLMWrapper
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.testset.graph import KnowledgeGraph
from ragas.testset.graph import Node, NodeType
from ragas.testset.transforms import default_transforms, apply_transforms
from ragas.testset import TestsetGenerator 
from ragas.testset.synthesizers import SingleHopSpecificQuerySynthesizer

from langchain_openai import ChatOpenAI
from langchain_openai import OpenAIEmbeddings

from config import settings

from api.company import run_article_rag

loader = TextLoader("backend/evaluation/test_article.txt")
docs = loader.load()
print(f"Loaded {len(docs)} documents")

# 
generator_llm = LangchainLLMWrapper(ChatOpenAI(api_key=settings.openai_api_key, model="gpt-4o-mini"))
generator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(api_key=settings.openai_api_key))

kg = KnowledgeGraph()
kg

for doc in docs: 
    kg.nodes.append(
        Node(
            type=NodeType.DOCUMENT,
            properties={"page_content": doc.page_content, "metadata": doc.metadata}
        )
    )

transformer_llm = generator_llm
embedding_model = generator_embeddings

default_transforms = default_transforms(documents=docs, llm=transformer_llm, embedding_model=embedding_model)
apply_transforms(kg, default_transforms)
kg

kg.save("usecase_data_kg.json")
usecase_data_kg = KnowledgeGraph.load("usecase_data_kg.json")
usecase_data_kg

generator = TestsetGenerator(llm=generator_llm, embedding_model=embedding_model, knowledge_graph=usecase_data_kg)

# Single-hop only; multi-hop synthesizers need clusters in the knowledge graph (multiple related nodes).
query_distribution = [
    (SingleHopSpecificQuerySynthesizer(llm=generator_llm), 1.0),
]

testset = generator.generate(testset_size = 20, query_distribution=query_distribution)

# Article URL for article RAG eval (must match test_article.txt content; e.g. TechCrunch)
ARTICLE_EVAL_URL = "https://techcrunch.com/2026/03/06/bill-gates-terrapower-gets-approval-to-build-new-nuclear-reactor/"


def _extract_url_from_doc(doc) -> str | None:
    """Extract first https URL from document content if present."""
    if not doc or not doc.page_content:
        return None
    m = re.search(r"https://[^\s]+", doc.page_content)
    return m.group(0).rstrip("/)") if m else None


# Run evaluation: article RAG (fetch URL, chunk, embed, top-k, LLM) — same path as company.py article-focused chat
_url = _extract_url_from_doc(docs[0] if docs else None) or ARTICLE_EVAL_URL
print(f"Article RAG eval (url={_url})")


async def _run_article_eval():
    for test_row in testset:
        answer, context = await run_article_rag(_url, test_row.eval_sample.user_input)
        test_row.eval_sample.response = answer
        test_row.eval_sample.retrieved_contexts = context


asyncio.run(_run_article_eval())