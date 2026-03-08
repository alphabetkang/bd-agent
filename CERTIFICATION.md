# Certification Challenge — BD Agent

---

## Problem Statement

CRE brokerage firms need to stay current on company movements and funding news.

---

## Why This Problem Matters

Commercial real estate (CRE) firms generate revenue by facilitating transactions between businesses and property owners. When a company outgrows its current space — or its requirements shift — a dedicated broker helps find the right fit. CRE firms thrive on this constant churn of business needs, and their pipeline depends on identifying the right prospects at the right moment.

Staying on top of business news is time-consuming and cognitively expensive. In practice, it means reading industry publications, researching companies that surface in headlines, and manually qualifying them as prospects. The process is open-ended, frequently interrupted by context switching, and requires sustained focus. Because the core task is extracting specific characteristics from companies to determine whether they are worth pursuing, it is a natural fit for AI automation.

---

## Evaluation Questions


| Question                                                                                  | Expected Answer                                                      |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| What are some tech companies in LA that need space?                                       | Here are 5 tech companies likely to need space in the next 12 months |
| Is there current news on biotech funding in Boston?                                       | No, biotech funding news has been sparse for the past 6 months       |
| What oil & gas companies require office space in the next 6 months and make over $5M ARR? | Here is a list of companies that meet your requirements              |


---

## Proposed Solution

I propose an agentic business development system that surfaces and researches companies and company news deemed relevant to the user's interests. The system continuously monitors news sources, extracts company signals, and presents qualified prospects — reducing the manual research burden on brokers.

Over time, this could evolve into a more flexible platform beyond CRE. It could learn user preferences and tailor searches to specific verticals, geographies, or deal characteristics.

---

## Infrastructure Diagram

[View on Miro](https://miro.com/app/board/uXjVG3yaLkI=/?focusWidget=3458764662075254229)

---

## RAG and Agent Components

**RAG components:**

- News feed retrieval from RSS sources (chunked, embedded, and stored in a vector database). For now, this will be only TechCrunch.
- Augmented answer generation grounded in retrieved news content

**Agent components:**

- Reasoning about which news feed chunks to retrieve for a given query
- Deciding whether retrieved context is sufficient or whether a live web search is needed
- Researching and identifying specific companies mentioned or implied by the query
- Reasoning about which companies to surface in the final response

---

## Data Sources and External APIs


| Source     | Type     | Purpose                                      |
| ---------- | -------- | -------------------------------------------- |
| TechCrunch | RSS feed | Tech industry news and funding announcements |


### Future Implementations:


| Source                    | Type           | Purpose                                                                             |
| ------------------------- | -------------- | ----------------------------------------------------------------------------------- |
| Boston Business Journal   | RSS feed       | Local Boston-area business news                                                     |
| Yahoo Finance             | RSS feed       | Broader financial and market news                                                   |
| Tavily                    | Web Search API | Live web search for queries that need fresher context                               |
| User-uploaded PDFs / DOCX | File upload    | Additional context ingested into the vector database via the same chunking pipeline |


---

## Chunking Strategy

Each RSS article is treated as a semantic unit and chunked at the article level. This ensures that each chunk captures a coherent, self-contained piece of news — typically centered on one or a small number of companies — rather than splitting context arbitrarily by token count. Keeping chunks aligned with individual articles preserves the relevance signal and reduces noise during retrieval.

---

## End-to-End Prototype

Deployed locally at `http://localhost:3000`. See `README.md` for setup instructions.

---

## RAGAS Pipeline Evaluation



The evaluation was performed using the test article from TechCrunch. This is because this platform currently dynamically loads news articles that are live on the TechCrunch website. For reproducibility purposes, a test news article is provided at 




| Metric             | Score |
| ------------------ | ----- |
| Faithfulness       | —     |
| Response Relevance | —     |
| Context Precision  | —     |
| Context Recall     | —     |


> Run `python -m evaluation.ragas_eval` from `backend/` to evaluate. Use `--update-cert` to auto-populate this table.

---

## Performance Conclusions

> **TODO:** Add conclusions based on RAGAS results above.

---

## Advanced Retrieval Technique

Two techniques were selected to improve retrieval quality:

1. **Reranking** — A reranker re-scores the initial retrieval candidates before passing context to the LLM, surfacing the most relevant chunks even when semantic similarity alone is imprecise.
2. **BM25 (keyword search)** — Hybrid retrieval using BM25 complements dense vector search for queries containing exact-match terms like city names (`Boston`) or funding terminology (`Series B`), where keyword overlap is a strong relevance signal.

---

## Post-Improvement RAGAS Results


| Metric             | Baseline | With Advanced Retrieval | Delta |
| ------------------ | -------- | ----------------------- | ----- |
| Faithfulness       | —        | —                       | —     |
| Response Relevance | —        | —                       | —     |
| Context Precision  | —        | —                       | —     |
| Context Recall     | —        | —                       | —     |


> **TODO:** Run RAGAS on improved pipeline and populate results.

---

## Retrieval Strategy for Demo Day

Yes — the dense vector retrieval approach will be retained for Demo Day, augmented by BM25 and reranking. This application has genuine utility beyond the certification challenge and was already on my product roadmap. There are many features still to build, and the retrieval quality improvements are worth shipping.

---

## Deliverables

- 5-minute Loom demo video
- Written document addressing each question (this file)
- All relevant code (see `backend/` and `frontend/`)

