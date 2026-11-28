# Product Requirements Document (PRD): NyayaSetu — Indian Consumer Rights Copilot

## 1. Executive Summary
**NyayaSetu** is an AI-powered research and build system designed to provide procedural guidance on Indian Consumer Rights. Developed as part of the Executive Post Graduate Programme at IIT KGP, the system leverages a multi-agent architecture to overcome the limitations of small-parameter language models (8B). NyayaSetu operates as a **100% local deployment**, ensuring data privacy and eliminating the need for external API costs, keys, or cloud dependencies. It gathers legal information via a Research Agent and constructs interactive responses via a Builder Agent, all validated by an automated Evaluation Judge.

## 2. Problem Statement
Small language models (≤8B parameters) frequently struggle with:
*   **Mathematical/Logic Errors:** Incorrectly calculating pecuniary jurisdiction.
*   **Hallucinations:** Citing outdated laws (e.g., Consumer Protection Act 1986 instead of 2019).
*   **Knowledge Cutoffs:** Lacking access to recent historical judgments and specific gazette notifications.
*   **Privacy Concerns:** Sending sensitive legal grievances to third-party cloud APIs.

NyayaSetu solves these by using a local RAG (Retrieval-Augmented Generation) pipeline and specialized Python tools to ground the LLM in factual, up-to-date legal data.

## 3. Goals & Objectives
*   **Local Autonomy:** Build a system that requires zero external API keys, URLs, or CA certificates.
*   **Accuracy Improvement:** Significantly exceed the 19% baseline accuracy of the naked Qwen3-8B model.
*   **Hybrid Research:** Implement a retrieval system combining keyword (BM25) and semantic (Dense) search.
*   **Automated Evaluation:** Use a high-parameter local model (Gemma 3 27B) to grade system performance against a "Gold Set" of 80 expert-verified questions.
*   **Responsible AI:** Implement PII scrubbing and strict refusal boundaries for legal drafting or outcome prediction.

## 4. Target Users / Stakeholders
*   **Indian Consumers:** Seeking procedural guidance on filing grievances.
*   **Legal Researchers:** Analyzing historical consumer court judgments.
*   **Hackathon Evaluators:** Assessing the technical implementation of agentic workflows on constrained hardware.

## 5. Functional Requirements

### 5.1 Data Gathering (Research Agent)
*   **Hybrid Retrieval:** Must combine BM25 (keyword) and Dense (vector) retrieval to find specific legal sections (e.g., "Section 35") and conceptual matches (e.g., "deficiency in service").
*   **Local Corpus:** Must index a 2,000-row master set derived from the Prarabdha legal dataset and the Consumer Protection Act 2019.
*   **Reranking:** Must use a Cross-Encoder to rerank the top 10 candidates into the Top 3 most relevant passages.

### 5.2 Interactive Building (Builder Agent)
*   **Response Generation:** Use Qwen3-8B to synthesize retrieved context into a clear, conversational response.
*   **Jurisdiction Routing:** Must pass claim values to a Python tool to determine the correct commission (District, State, or National).
*   **Experimentation Grid:** Support a 3x2 evaluation grid: (Zero-shot, Few-shot, Chain-of-Thought) × (With/Without RAG).

### 5.3 Specialized Tools
*   **Jurisdiction Calculator:** A hard-coded Python tool applying CPA 2019/2021 pecuniary limits.
*   **PII Scrubber:** A regex-based pre-processor to remove phone numbers and emails from user queries.

### 5.4 Evaluation (Judge Agent)
*   **Judge v2:** Use Gemma 3 27B to grade responses on a 1–5 scale based on a specific rubric (type rationale, answer rationale, and failure taxonomy).
*   **Gold Set Testing:** Automated testing against 80 queries (30 Math/Logic, 30 Fact/Info, 20 Adversarial).

## 6. Non-Functional Requirements
*   **Performance:** Local inference latency should be optimized for real-time interaction on 16GB+ RAM hardware.
*   **Privacy:** 100% local execution; no data transmitted to external servers.
*   **Reliability:** Temperature set to 0 for reproducible, deterministic outputs.
*   **Scalability:** ChromaDB local persistence to handle up to 2,000+ document chunks.

## 7. System Architecture Overview
The system follows a local-first agentic architecture:
1.  **Client Layer:** Streamlit UI for user interaction and PII scrubbing.
2.  **Edge Layer:** FastAPI-based Gateway (Ollama compatible) managing internal routing.
3.  **Orchestration Layer:** LangChain-powered RAG Engine coordinating the Research and Build agents.
4.  **Research Agent:** Hybrid Retriever + Cross-Encoder Reranker querying ChromaDB.
5.  **Inference Layer:** Ollama hosting Qwen3-8B (Builder) and Gemma 3 27B (Judge).
6.  **Data Layer:** Local file system (JSONL/CSV) and ChromaDB vector store.

## 8. Tech Stack
*   **Frontend:** Streamlit, Pandas
*   **Orchestration:** LangChain, Python 3.11+, FastAPI
*   **LLM Server:** Ollama (Local)
*   **Models:** Qwen3-8B-FP16 (Builder), Gemma 3 27B (Judge)
*   **Vector Database:** ChromaDB
*   **Embeddings:** `all-mpnet-base-v2` (Local)
*   **Reranker:** `FlashrankRerank` (ms-marco-MiniLM-L-6-v2)
*   **Data Processing:** RecursiveCharacterTextSplitter, BM25Retriever

## 9. Data Requirements
*   **Master Corpus:** 2,000 rows (Question/Context/Answer) stored in `data/processed/master_qa.jsonl`.
*   **Gold Set:** 80 rows for evaluation stored in `data/processed/gold_qa.jsonl`.
*   **Chunking Strategy:** 500-token chunks with 100-token overlap for legal statutes.
*   **Persistence:** ChromaDB persisted to `chroma_db/` directory.

## 10. API Specifications
*   **Internal Gateway:** `POST /v1/chat/completions` (Ollama-compatible).
*   **RAG Engine:** Internal Python methods for `retrieve()`, `calculate()`, and `generate()`.
*   **Judge API:** Local endpoint for triggering batch evaluation of the Gold Set.

## 11. Security Requirements
*   **Local-Only:** No `API_KEY` or `BASE_URL` for external providers permitted.
*   **PII Protection:** Regex-based scrubbing of names, emails, and phone numbers at the UI level.
*   **Refusal Logic:** System must refuse to draft legal notices or predict case win probabilities.

## 12. Deployment & Infrastructure
*   **Environment:** Local machine with 16GB-32GB RAM and GPU support (Pathway A).
*   **Containerization:** Dockerfile provided to package Streamlit, LangChain, and dependencies.
*   **Model Management:** Models managed via `ollama pull qwen3:8b-fp16` and `ollama pull gemma3:27b`.

## 13. Success Metrics
*   **Recall@3:** Target >90% for the Hybrid Retriever on Fact/Info queries.
*   **Jurisdiction Accuracy:** 100% (ensured by the Python Calculator tool).
*   **Overall Accuracy:** Target >70% (as graded by Judge v2).
*   **Safety:** 0% production of prohibited content (legal notices/predictions).

## 14. Timeline & Milestones
*   **Week 1:** Environment setup (Ollama), Baseline testing (19% accuracy documented).
*   **Week 2:** RAG implementation (Hybrid Search + Reranking), Recall@3 measurement.
*   **Week 3:** Integration of Jurisdiction Tool and Builder Agent logic.
*   **Week 4:** Final Evaluation (Judge v2), Streamlit UI finalization, and Shipping.

## 15. Open Questions & Risks
*   **Hardware Constraint:** Running Gemma 3 27B locally requires significant RAM (~32GB); fallback to a smaller judge model may be needed for lower-spec machines.
*   **Context Window:** Qwen3-8B's 1,024 output token limit may truncate long legal explanations.
*   **Data Quality:** The 2,000-row corpus must be strictly de-duplicated to prevent retrieval of redundant information.