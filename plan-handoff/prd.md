# NyayaSetu — Indian Consumer Rights Copilot

## 1. Overview

NyayaSetu is an authenticated consumer-rights research application that helps Indian consumers understand grievance procedures, determine pecuniary jurisdiction, and find supporting legal sources.

The end-to-end MVP will include:

- Email/password registration and login.
- A guided consumer-rights question interface.
- Local PII detection and redaction before agent processing.
- Hybrid legal retrieval combining lexical and semantic search.
- Cross-encoder reranking to select the three strongest passages.
- Deterministic jurisdiction calculation using CPA 2019 and 2021 rules.
- Grounded answers with source citations, limitations, and next steps.
- Refusal controls for legal drafting and outcome prediction.
- Persistent conversations and saved answers.
- An evaluation workspace for the 80-question Gold Set.
- Experiment comparisons across prompting and retrieval configurations.
- Recall@3, answer-quality, jurisdiction, latency, and safety metrics.
- Docker-based development and deployment.
- GitHub-ready source structure.

### Implementation decision

The selected default Lyzr-agent path conflicts with the PRD’s local-only guarantee. For this plan:

- PII scrubbing, corpus retrieval, jurisdiction calculation, and application records remain application-controlled.
- Redacted questions and retrieved excerpts are sent to hosted Lyzr agents.
- No unredacted email address or phone number is included in agent requests.
- Lyzr agents use only model/provider combinations available in the current environment.
- The interface must clearly disclose that AI processing is hosted.
- Local Ollama adapters may be implemented as a later deployment mode, but they are not the initial agent runtime.

### MVP boundaries

NyayaSetu provides legal information and procedural guidance. It does not:

- Establish an advocate-client relationship.
- Draft legal notices, pleadings, affidavits, or complaints for filing.
- Predict whether a case will be won.
- Recommend fabricated citations.
- calculate jurisdiction through an LLM when the deterministic calculator is applicable.
- Replace official commission rules, statutes, or professional legal advice.

## 2. User Stories

### Consumer

- As a consumer, I can register and sign in securely.
- As a consumer, I can describe a grievance in ordinary language.
- As a consumer, I am warned before entering unnecessary personal information.
- As a consumer, I can see what PII was removed before my question is processed.
- As a consumer, I can enter the amount paid and compensation claimed.
- As a consumer, I receive the appropriate consumer commission from a deterministic calculator.
- As a consumer, I receive a concise answer grounded in retrieved legal passages.
- As a consumer, I can distinguish statutory sources from historical decisions.
- As a consumer, I can inspect citations and retrieved excerpts.
- As a consumer, I can save, reopen, rename, and delete my conversations.
- As a consumer, I receive a refusal when requesting prohibited drafting or outcome prediction.

### Legal researcher

- As a researcher, I can search for sections, concepts, and historical judgments.
- As a researcher, I can inspect retrieval scores and source metadata.
- As a researcher, I can compare keyword, dense, hybrid, and reranked results.
- As a researcher, I can distinguish the model’s synthesis from source text.

### Evaluator or administrator

- As an evaluator, I can run the Gold Set against a selected experiment configuration.
- As an evaluator, I can compare zero-shot, few-shot, and structured-reasoning modes.
- As an evaluator, I can compare RAG-enabled and non-RAG configurations.
- As an evaluator, I can review Judge scores and failure taxonomies.
- As an evaluator, I can inspect jurisdiction accuracy, Recall@3, safety failures, and latency.
- As an evaluator, I can rerun failed cases without rerunning the full suite.
- As an evaluator, I can export evaluation results as CSV or JSON.

## 3.a. Agent Architecture

The hosted agent system uses one manager and three specialized sub-agents. Deterministic calculations and retrieval remain tools rather than agents.

| Agent Type | Agent Name | Description | Tools/Data Sources | Trigger | Provider | Model | Temperature | Top_p |
|---|---|---|---|---|---|---|---:|---:|
| Manager | NyayaSetu Orchestrator | Classifies requests, enforces safety boundaries, delegates research and response construction, and assembles the final grounded result. | Local legal-service custom tool; Research Agent; Builder Agent | A scrubbed consumer question is submitted | Anthropic | `anthropic/claude-sonnet-4-6` | 0 | 1 |
| Sub-Agent | Consumer Law Research Agent | Converts the question into retrieval queries, invokes hybrid retrieval, validates source relevance, and returns ranked evidence with metadata. | Local legal-service custom tool: hybrid search and rerank actions | Delegated research request | OpenAI | `gpt-5-mini` | 0 | 1 |
| Sub-Agent | Consumer Guidance Builder | Produces concise procedural guidance using only approved evidence and deterministic jurisdiction results. It must attach citations and limitations. | Ranked evidence and calculator output supplied by the manager | Research evidence is ready | Anthropic | `anthropic/claude-haiku-4-5` | 0 | 1 |
| Sub-Agent | Evaluation Judge | Grades test responses using the Gold Set rubric, returning scores, rationale, safety status, and a controlled failure category. | Gold reference and generated response supplied by evaluation workflow | Evaluation case completes | Google | `gemini/gemini-2.5-pro` | 0 | 1 |

### Agent rules

1. The manager must never infer pecuniary jurisdiction itself.
2. The Research Agent must return source identifiers and excerpts, not unsupported conclusions.
3. The Builder must answer only from retrieved evidence and calculator results.
4. If evidence is weak or contradictory, the Builder must say so.
5. Internal chain-of-thought must never be displayed or persisted.
6. “Structured reasoning” experiments store only short answer rationales and auditable steps.
7. The Judge cannot modify production answers.
8. Judge grades must be labeled as automated evaluation, not legal validation.
9. Agent requests receive redacted text rather than the original user question.

## 3.c. Local Legal Service

A Python 3.11+ FastAPI service provides deterministic and retrieval operations.

### Required modules

- PII scrubber.
- Request safety classifier.
- Corpus importer and validator.
- Text chunker using 500-token chunks with 100-token overlap.
- Dense embedding indexer.
- BM25 indexer.
- Hybrid result fusion.
- Cross-encoder reranker.
- Jurisdiction calculator.
- Retrieval benchmark runner.
- Gold Set evaluation runner.
- Health and readiness checks.

### Core service endpoints

- `GET /health`
- `GET /ready`
- `POST /v1/pii/scrub`
- `POST /v1/safety/classify`
- `POST /v1/retrieve`
- `POST /v1/jurisdiction/calculate`
- `POST /v1/evaluations/retrieval`
- `POST /v1/evaluations/case`
- `POST /v1/evaluations/batch`

The service must expose an OpenAPI schema so it can be registered as a Lyzr custom tool.

## 3.d. Retrieval Pipeline

1. Validate and normalize the redacted question.
2. Detect exact legal references such as “Section 35.”
3. Run BM25 retrieval for lexical matches.
4. Generate a local embedding and run semantic retrieval.
5. Retrieve at least ten candidates from each eligible path.
6. Fuse results using normalized scores or reciprocal-rank fusion.
7. Deduplicate overlapping chunks.
8. Rerank the strongest ten candidates with the cross-encoder.
9. Return the top three passages.
10. Attach source title, section, document type, stable source ID, excerpt, and scores.

### Corpus preparation

Expected source files:

- `data/processed/master_qa.jsonl`
- Consumer Protection Act 2019 text.
- Applicable 2021 jurisdiction rules or notifications.
- Historical consumer decisions included in the approved corpus.
- `data/processed/gold_qa.jsonl`

The application should include import commands and validation, but not fabricate missing corpus content.

## 3.e. Jurisdiction and Safety Logic

### Jurisdiction calculation

The calculator must use the legally applicable consideration-value basis and configurable thresholds. Rules must be represented as versioned configuration with:

- Effective date.
- Legal authority.
- Lower and upper bounds.
- Commission name.
- Explanatory note.

Every result must include:

- Selected commission.
- Amount used.
- Rule version.
- Effective date.
- Plain-language explanation.
- Warning when information is insufficient.

The thresholds must be verified against the supplied authoritative notification before release.

### PII processing

The preprocessor detects and redacts:

- Email addresses.
- Indian and international phone-number patterns.
- Account-like numeric identifiers when confidently detected.
- Optional user-supplied names.

The UI shows the redacted version before submission. Original and redacted text must be stored separately, encrypted where supported, and never included in logs.

### Safety classification

Refuse or redirect requests that ask the system to:

- Draft a legal notice or filing-ready pleading.
- Predict a win percentage or guaranteed outcome.
- Impersonate an advocate.
- Fabricate evidence or citations.
- Harass or threaten another party.

Permitted assistance includes issue summaries, procedural checklists, relevant statutory information, official filing-channel guidance, and questions a user may discuss with an advocate.

## 3.f. Evaluation Framework

### Experiment grid

| Prompting mode | Without RAG | With RAG |
|---|---:|---:|
| Zero-shot | Supported | Supported |
| Few-shot | Supported | Supported |
| Structured reasoning | Supported | Supported |

“Structured reasoning” replaces exposed chain-of-thought with brief, auditable reasoning summaries.

### Gold Set categories

- 30 Math/Logic questions.
- 30 Fact/Information questions.
- 20 Adversarial or safety questions.

### Judge result

Each evaluation case records:

- Overall score from 1–5.
- Answer-type rationale.
- Answer-quality rationale.
- Citation-grounding score.
- Jurisdiction correctness.
- Safety pass/fail.
- Failure taxonomy.
- Latency.
- Retrieval configuration.
- Model and prompt version.

### Failure taxonomy

- Incorrect jurisdiction.
- Outdated legal basis.
- Unsupported factual claim.
- Missing relevant source.
- Citation mismatch.
- Incomplete procedure.
- Unsafe legal drafting.
- Outcome prediction.
- Over-refusal.
- Retrieval failure.
- Truncation.
- Judge parse failure.

## 3.g. Database Configuration

NyayaSetu uses built-in PostgreSQL for structured, cross-session application records. Email/password authentication is mandatory, and all application screens except login and registration are gated.

### Core tables

- `users`: identity and authentication ownership.
- `user_profiles`: display name, role, consent timestamps, and preferences.
- `conversations`: owner, title, status, and timestamps.
- `messages`: original user text, redacted text, role, status, and latency.
- `answers`: synthesized response, limitations, safety decision, and model version.
- `citations`: answer ownership, source ID, excerpt, rank, and retrieval scores.
- `jurisdiction_results`: input amounts, selected commission, and rule version.
- `evaluation_runs`: configuration, status, aggregate metrics, and timestamps.
- `evaluation_cases`: Gold Set case result, scores, rationale, taxonomy, and latency.
- `prompt_versions`: versioned agent instructions and experiment mode.
- `audit_events`: security-relevant actions without raw sensitive prompt content.

### Ownership and access

- Every conversation and evaluation run is scoped to an authenticated owner.
- Administrator access is role-controlled.
- User-facing queries must always include owner scoping.
- Users may export or delete their own conversations.
- Evaluation datasets and global prompt definitions are restricted to evaluators or administrators.
- Raw prompts must not appear in telemetry or application logs.

### Vector and corpus persistence

The legal corpus and vector index are operational research data, separate from user records. The implementation may maintain a local Chroma-compatible persistent index for retrieval, while PostgreSQL remains the system of record for accounts, histories, and evaluation results.

## 4. User Flow

### Authentication

1. User opens NyayaSetu.
2. User creates an account or signs in.
3. User accepts the legal-information and hosted-processing disclosures.
4. User enters the protected application.

### Consumer guidance

1. User starts a new question.
2. User selects a topic or enters a free-form grievance.
3. User optionally provides purchase price, amount paid, and compensation sought.
4. The local service detects PII and prohibited intent.
5. The user reviews the redacted query.
6. The manager classifies the approved request.
7. The Research Agent invokes hybrid retrieval.
8. The calculator determines jurisdiction when sufficient values are present.
9. The Builder creates a grounded answer.
10. The UI displays:
    - Direct answer.
    - Recommended next steps.
    - Jurisdiction result.
    - Sources and excerpts.
    - Missing information.
    - Safety and legal-information notice.
11. The conversation is saved to the user’s history.

### Refusal

1. A prohibited request is detected.
2. The system explains the boundary without reproducing harmful content.
3. It offers allowed alternatives, such as a checklist of information to gather.
4. The refusal category is recorded without sensitive content.

### Evaluation

1. An evaluator opens the evaluation workspace.
2. The evaluator selects prompt mode, RAG state, and dataset scope.
3. The system creates an evaluation run.
4. Cases execute with visible progress and retry controls.
5. The Judge grades completed answers.
6. Aggregate metrics and failure distributions are displayed.
7. The evaluator inspects individual cases and exports results.

## 5. Integrations Required

### Lyzr hosted agents

The application invokes the NyayaSetu manager, which delegates to Research, Builder, and Judge agents.

Required response fields include:

- Request classification.
- Safety decision.
- Grounded answer.
- Procedural steps.
- Missing information.
- Citation references.
- Jurisdiction-tool result.
- Limitations.
- Evaluation result when applicable.

### Local legal-service custom tool

No suitable integration is currently registered. Add the FastAPI legal service through **“+” → “Add custom tool”** in the message composer using its OpenAPI schema.

Required custom-tool actions:

- Scrub PII.
- Classify request safety.
- Run hybrid retrieval.
- Rerank passages.
- Calculate jurisdiction.
- Run retrieval evaluation.
- Trigger an evaluation case.
- Trigger a batch evaluation.

The service must be reachable by the hosted agent runtime. A service that is available only at `localhost` cannot be called by hosted Lyzr agents.

### GitHub

The `github` integration is available for repository operations. Once the repository is shared and authorization is available, implementation work can be committed through a feature branch and submitted as a pull request.

No GitHub repository has been provided yet, so the plan does not assume an existing scaffold, branching policy, or CI workflow.

## 6. UI/UX Specification

NyayaSetu uses a trustworthy civic-technology visual language: deep ink backgrounds, warm saffron accents, off-white reading surfaces, restrained borders, and high-contrast status colors. It must not resemble a generic chat application.

**Authentication:** Login and sign-up share a simple split layout with product purpose, privacy disclosure, and legal-information limitations. Registration includes consent for hosted redacted processing.

**Research workspace:** A left rail contains conversations and navigation. The main canvas uses a structured grievance form with question, issue category, transaction amount, compensation amount, and optional dates. Before processing, a redaction preview identifies removed PII.

**Answer workspace:** Results prioritize a direct answer and recommended actions. Jurisdiction appears as a deterministic result card. Sources appear in a separate evidence panel with document type, section, excerpt, and retrieval score. Safety notices remain visible without dominating the answer.

**Evaluation workspace:** Evaluators receive configuration controls, run progress, metric cards, experiment comparisons, and a filterable case table. Failed cases open into a detailed evidence and grading view.

Interaction requirements:

- Responsive from tablet to desktop; mobile supports consumer guidance.
- Keyboard-accessible controls and visible focus states.
- Minimum WCAG AA contrast.
- Clear loading stages for scrubbing, retrieval, reranking, and generation.
- Agent errors must preserve the user’s draft and provide retry controls.
- No internal chain-of-thought is rendered.
- Destructive actions require confirmation.
- Hosted-processing disclosure remains accessible from every authenticated screen.

## Artifacts & references

- Supplied NyayaSetu PRD.
- Supplied one-page system architecture diagram.
- Expected corpus: `data/processed/master_qa.jsonl`.
- Expected Gold Set: `data/processed/gold_qa.jsonl`.
- Consumer Protection Act 2019.
- Applicable 2021 pecuniary-jurisdiction rules or notifications.
- Repository URL: pending.
- Corpus and Gold Set files: pending.
- Local legal-service custom tool registration: pending.
- Final jurisdiction thresholds and authoritative source verification: pending.