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
from ragas.llms import llm_factory
from ragas.embeddings import LangchainEmbeddingsWrapper
from ragas.testset import TestsetGenerator 
from ragas.testset.synthesizers import SingleHopSpecificQuerySynthesizer

from openai import OpenAI
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
client = OpenAI(api_key=settings.openai_api_key)
generator_llm = llm_factory(client=client, model="gpt-4o-mini")
generator_embeddings = LangchainEmbeddingsWrapper(OpenAIEmbeddings(api_key=settings.openai_api_key))

# SingleHopSpecificQuerySynthesizer needs nodes with an "entities" property. The default
# document pipeline only adds entities to CHUNK nodes; with one long doc, HeadlineSplitter
# often yields a single segment so no CHUNKs are created. Pre-chunk by paragraph so we
# get multiple CHUNK nodes that receive NER and entities.
def _chunk_doc_by_paragraphs(doc) -> list:
    from langchain_core.documents import Document
    blocks = [b.strip() for b in doc.page_content.split("\n\n") if b.strip()]
    if not blocks:
        return [doc]
    return [Document(page_content=block, metadata=doc.metadata) for block in blocks]

chunks = []
for doc in docs:
    chunks.extend(_chunk_doc_by_paragraphs(doc))
print(f"Pre-chunked into {len(chunks)} chunks")

generator = TestsetGenerator(llm=generator_llm, embedding_model=generator_embeddings)

# Single-hop only; multi-hop synthesizers need clusters in the knowledge graph (multiple related nodes).
query_distribution = [
    (SingleHopSpecificQuerySynthesizer(llm=generator_llm), 1.0),
]

testset = generator.generate_with_chunks(
    chunks,
    testset_size=20,
    query_distribution=query_distribution,
    transforms_llm=generator_llm,
    transforms_embedding_model=generator_embeddings,
)

# Persist the built KG for inspection/reuse (optional)
generator.knowledge_graph.save(Path(__file__).resolve().parent / "usecase_data_kg.json")

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

# if UPDATE_CERT:
#     # Map ragas metric keys to CERTIFICATION.md table row names (first RAGAS table only)
#     _metric_display = {
#         "faithfulness": "Faithfulness",
#         "answer_relevancy": "Response Relevance",
#         "context_precision": "Context Precision",
#         "context_recall": "Context Recall",
#     }
#     cert_path = Path(__file__).resolve().parent.parent.parent / "CERTIFICATION.md"
#     if not cert_path.exists():
#         print("CERTIFICATION.md not found at", cert_path, "- skipping update")
#     else:
#         lines = cert_path.read_text().splitlines()
#         for ragas_key, display_name in _metric_display.items():
#             score = result._repr_dict.get(ragas_key)
#             if score is None:
#                 continue
#             score_str = f"{float(score):.2f}"
#             # Update only the two-column "| Metric | Score |" table (not the Baseline table)
#             for i, line in enumerate(lines):
#                 if f"| {display_name}" in line and "| —     |" in line:
#                     lines[i] = line.replace("| —     |", f"| {score_str}   |")
#                     break
#         cert_path.write_text("\n".join(lines) + "\n")
#         print("Updated", cert_path)