"""
RAGAS Pipeline Evaluation for BD Agent.

Runs the research pipeline on certification evaluation questions, then scores
the RAG output using RAGAS metrics: Faithfulness, Response Relevance,
Context Precision, and Context Recall.

Usage (from backend/ directory):
    python -m evaluation.ragas_eval

Requires: OPENAI_API_KEY, TAVILY_API_KEY in .env
Ensure RSS feeds are ingested first (start the server once to populate Chroma).
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Ensure backend is on path when run as module
_backend = Path(__file__).resolve().parent.parent
if str(_backend) not in sys.path:
    sys.path.insert(0, str(_backend))

os.chdir(_backend)

# Load .env before importing app modules
from dotenv import load_dotenv
load_dotenv(_backend / ".env")

from ragas import EvaluationDataset, SingleTurnSample, evaluate

from agents.graph import research_graph
from agents.state import ResearchState

# Evaluation questions from CERTIFICATION.md
EVAL_QUESTIONS = [
    {
        "question": "What are some tech companies in LA that need space?",
        "expected_answer": "Here are 5 tech companies likely to need space in the next 12 months",
    },
    {
        "question": "Is there current news on biotech funding in Boston?",
        "expected_answer": "No, biotech funding news has been sparse for the past 6 months",
    },
    {
        "question": "What oil & gas companies require office space in the next 6 months and make over $5M ARR?",
        "expected_answer": "Here is a list of companies that meet your requirements",
    },
]


def _split_context(context: str) -> list[str]:
    """Split combined context string into list of passages for RAGAS."""
    if not context or context.strip() == "":
        return []
    return [p.strip() for p in context.split("\n\n---\n\n") if p.strip()]


def _combine_contexts(rag_context: str, web_context: str) -> list[str]:
    """Combine RAG and web contexts into a single list of passages."""
    rag_passages = _split_context(rag_context)
    web_passages = _split_context(web_context)
    return rag_passages + web_passages


async def run_pipeline(query: str) -> ResearchState:
    """Run the research graph and return final state."""
    initial_state: ResearchState = {
        "query": query,
        "messages": [],
        "rag_context": "",
        "web_context": "",
        "final_answer": "",
        "companies": [],
    }
    final_state = await research_graph.ainvoke(initial_state)
    return final_state


async def collect_eval_data() -> list[dict]:
    """Run the pipeline for each eval question and collect (query, contexts, answer)."""
    results = []
    for i, item in enumerate(EVAL_QUESTIONS):
        q = item["question"]
        print(f"[{i + 1}/{len(EVAL_QUESTIONS)}] Running pipeline: {q[:60]}...")
        try:
            state = await run_pipeline(q)
            contexts = _combine_contexts(
                state.get("rag_context", ""),
                state.get("web_context", ""),
            )
            results.append(
                {
                    "question": q,
                    "expected_answer": item["expected_answer"],
                    "answer": state.get("final_answer", ""),
                    "contexts": contexts,
                }
            )
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append(
                {
                    "question": q,
                    "expected_answer": item["expected_answer"],
                    "answer": "",
                    "contexts": [],
                }
            )
    return results


def build_dataset(data: list[dict]) -> EvaluationDataset:
    """Build RAGAS EvaluationDataset from pipeline outputs."""
    samples = []
    for row in data:
        contexts = row["contexts"]
        if not contexts:
            contexts = ["No relevant context retrieved."]
        sample = SingleTurnSample(
            user_input=row["question"],
            retrieved_contexts=contexts,
            response=row["answer"] or "",
            reference=row["expected_answer"],
        )
        samples.append(sample)
    return EvaluationDataset(samples=samples)


def run_ragas(dataset: EvaluationDataset) -> dict:
    """Run RAGAS evaluation and return metric scores.

    Uses default RAGAS metrics: faithfulness, answer_relevancy,
    context_precision, context_recall.
    """
    result = evaluate(dataset)
    # result is EvaluationResult; scores is list of dicts, one per row
    scores = result.scores
    if not scores:
        return {}
    # Aggregate to mean per metric (exclude None and NaN)
    metric_keys = ["faithfulness", "answer_relevancy", "context_precision", "context_recall"]
    agg = {}
    for key in metric_keys:
        values = []
        for s in scores:
            v = s.get(key)
            if v is not None and (not isinstance(v, float) or v == v):  # v==v excludes nan
                values.append(v)
        agg[key] = sum(values) / len(values) if values else None
    return agg


def format_scores(scores: dict) -> str:
    """Format scores for CERTIFICATION.md table (e.g. 0.85 or —)."""
    def fmt(v):
        if v is None or (isinstance(v, float) and str(v) == "nan"):
            return "—"
        return f"{v:.2f}"
    return {k: fmt(v) for k, v in scores.items()}


METRIC_DISPLAY = [
    ("faithfulness", "Faithfulness"),
    ("answer_relevancy", "Response Relevance"),
    ("context_precision", "Context Precision"),
    ("context_recall", "Context Recall"),
]


def update_certification_md(formatted: dict, cert_path: Path) -> None:
    """Update CERTIFICATION.md with RAGAS results."""
    content = cert_path.read_text()
    # Replace the baseline table (first occurrence of the RAGAS Pipeline Evaluation table)
    old_table = """| Metric             | Score |
| ------------------ | ----- |
| Faithfulness       | —     |
| Response Relevance | —     |
| Context Precision  | —     |
| Context Recall     | —     |"""
    new_table = "| Metric             | Score |\n| ------------------ | ----- |\n"
    for name, display in METRIC_DISPLAY:
        new_table += f"| {display:<19} | {formatted.get(name, '—'):>5} |\n"
    new_table = new_table.rstrip()
    if old_table in content:
        content = content.replace(old_table, new_table)
        content = content.replace(
            "> **TODO:** Run RAGAS evaluation and populate results.",
            "> Run `python -m evaluation.ragas_eval` from `backend/` to re-run evaluation.",
        )
        cert_path.write_text(content)
        print(f"\nUpdated {cert_path}")
    else:
        print("\nCould not find table in CERTIFICATION.md to update.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="RAGAS pipeline evaluation for BD Agent")
    parser.add_argument(
        "--update-cert",
        action="store_true",
        help="Update CERTIFICATION.md with results",
    )
    args = parser.parse_args()

    print("BD Agent — RAGAS Pipeline Evaluation")
    print("=" * 50)
    print("Phase 1: Running pipeline on evaluation questions...")
    data = asyncio.run(collect_eval_data())
    print("\nPhase 2: Building RAGAS dataset...")
    dataset = build_dataset(data)
    print(f"  Samples: {len(dataset)}")
    print("\nPhase 3: Running RAGAS metrics (this may take a few minutes)...")
    scores = run_ragas(dataset)
    formatted = format_scores(scores)
    print("\n" + "=" * 50)
    print("Results (mean scores):")
    print(json.dumps(formatted, indent=2))
    print("\nCERTIFICATION.md format:")
    print("| Metric             | Score |")
    print("| ------------------ | ----- |")
    for name, display in METRIC_DISPLAY:
        print(f"| {display:<19} | {formatted.get(name, '—'):>5} |")

    if args.update_cert:
        cert_path = _backend.parent / "CERTIFICATION.md"
        if cert_path.exists():
            update_certification_md(formatted, cert_path)
        else:
            print(f"\nCERTIFICATION.md not found at {cert_path}")

    return formatted


if __name__ == "__main__":
    main()
