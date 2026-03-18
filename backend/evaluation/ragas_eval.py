import argparse
import asyncio
import re
import sys
from pathlib import Path

# Parse --update-cert before heavy imports
_parser = argparse.ArgumentParser()
_parser.add_argument("--update-cert", action="store_true", help="Update CERTIFICATION.md with RAGAS scores")
_args, _ = _parser.parse_known_args()
UPDATE_CERT = _args.update_cert

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

from ragas import evaluate

from config import settings

from api.company import run_article_rag

_test_article = Path(__file__).resolve().parent / "test_article.txt"
loader = TextLoader(str(_test_article))
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

# Run RAGAS metrics on the filled testset (need at least one sample)
if not testset.samples:
    print("No testset samples were generated; skipping RAGAS evaluate and cert update.")
    print("Check that the knowledge graph has nodes and that testset_size / query_distribution produce samples.")
    sys.exit(1)

eval_dataset = testset.to_evaluation_dataset()
result = evaluate(
    eval_dataset,
    llm=generator_llm,
    embeddings=generator_embeddings,
)
print("RAGAS scores:", result)

if UPDATE_CERT:
    # Map ragas metric keys to CERTIFICATION.md table row names (first RAGAS table only)
    _metric_display = {
        "faithfulness": "Faithfulness",
        "answer_relevancy": "Response Relevance",
        "context_precision": "Context Precision",
        "context_recall": "Context Recall",
    }
    cert_path = Path(__file__).resolve().parent.parent.parent / "CERTIFICATION.md"
    if not cert_path.exists():
        print("CERTIFICATION.md not found at", cert_path, "- skipping update")
    else:
        lines = cert_path.read_text().splitlines()
        for ragas_key, display_name in _metric_display.items():
            score = result._repr_dict.get(ragas_key)
            if score is None:
                continue
            score_str = f"{float(score):.2f}"
            # Update only the two-column "| Metric | Score |" table (not the Baseline table)
            for i, line in enumerate(lines):
                if f"| {display_name}" in line and "| —     |" in line:
                    lines[i] = line.replace("| —     |", f"| {score_str}   |")
                    break
        cert_path.write_text("\n".join(lines) + "\n")
        print("Updated", cert_path)