# DealGraph

AI-powered due diligence copilot for venture capital investors. Upload any startup's pitch deck and get a confidence-scored investment analysis with verified claims, competitive intelligence, and a voice-narrated deal memo.

## Live Demo

**[→ DealGraph (dealgraph-pink.vercel.app)](https://dealgraph-pink.vercel.app/)**

## Table of Contents

- [Live Demo](#live-demo)
- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [How It Works](#how-it-works)
- [API Endpoints](#api-endpoints)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Overview

DealGraph takes a pitch deck (PDF or text), extracts every verifiable claim, and routes each claim to the right verification engine — graph database, live web search, or LLM judgment. The result is a confidence-weighted investment score, a structured memo, and a voice briefing.

| Agent                  | Role                                                                  |
| ---------------------- | --------------------------------------------------------------------- |
| **ClaimExtractor**     | Pulls every verifiable claim from the pitch deck                      |
| **ClaimRouter**        | Classifies claims: factual_static, factual_dynamic, qualitative, unverifiable |
| **GraphResolver**      | Verifies static facts against the Memgraph knowledge graph (optional) |
| **WebResolver**        | Verifies dynamic facts via Tavily web search                          |
| **LLMJudge**          | Assesses qualitative claims using LLM reasoning                       |
| **EvidenceNormalizer** | Standardizes all evidence with source, freshness, and confidence      |
| **DealScorer**         | Confidence-weighted scoring across 5 dimensions                       |
| **MemoWriter**         | Generates investment memo + 60-90s voice briefing                     |

## Key Features

- **Works for any company** — no pre-seeded data required; web search verifies claims in real time
- **Claim-level routing** — each claim goes to the right resolver (graph, web, LLM, or flagged)
- **Confidence-aware scoring** — verified claims count more; contradicted claims reduce scores
- **Competitive landscape graph** — D3 force-directed visualization of competitors
- **Voice deal memos** — AI-narrated audio briefings via edge-tts
- **CopilotKit chat** — conversational follow-up with generative UI cards
- **Memgraph optional** — graph DB enriches results when connected, not required
- **Multi-provider LLM** — supports Groq, Ollama, Together.ai, and OpenAI

## Tech Stack

- **Backend**: Python + FastAPI + [Strands Agents](https://github.com/strands-agents/sdk-python)
- **Frontend**: Next.js 15 + React + Tailwind CSS + [CopilotKit](https://copilotkit.ai)
- **LLM**: Groq (Llama 3.3 70B) / Ollama / Together.ai / OpenAI
- **Web Search**: [Tavily](https://tavily.com) (free tier: 1000 searches/month)
- **Graph DB**: Memgraph (optional, Bolt-compatible)
- **TTS**: edge-tts (free Microsoft Edge voices)
- **Visualization**: D3.js force-directed graph

## Project Structure

```
dealgraph/
├── backend/
│   ├── main.py                         # FastAPI app, endpoints, CopilotKit handler
│   ├── model_config.py                 # LLM provider factory (Groq/Ollama/Together/OpenAI)
│   ├── requirements.txt
│   ├── agents/
│   │   ├── orchestrator.py             # Pipeline: Extract → Route → Resolve → Normalize → Score → Memo
│   │   ├── claim_extractor.py          # Step 1: Extract claims from pitch deck
│   │   ├── claim_router.py             # Step 2: Classify claims into 4 categories
│   │   ├── llm_judge.py               # Step 3c: Assess qualitative claims
│   │   ├── evidence_normalizer.py      # Step 4: Standardize evidence (source, confidence)
│   │   ├── deal_scorer.py              # Step 5: Confidence-weighted scoring
│   │   ├── memo_writer.py             # Step 6: Investment memo + voice briefing
│   │   └── shared_state.py            # Per-request state isolation (contextvars)
│   └── tools/
│       ├── graph_resolver.py           # Step 3a: Verify against Memgraph
│       ├── web_resolver.py             # Step 3b: Verify via Tavily web search
│       ├── neo4j_tools.py              # Memgraph connection + Cypher queries
│       ├── minimax_tts.py              # edge-tts audio generation
│       └── deck_parser.py              # PDF text extraction
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                # Dashboard (upload, analyze, results)
│   │   │   └── chat/page.tsx           # Full-page CopilotKit chat
│   │   ├── components/
│   │   │   ├── cards/                  # Shared generative UI cards
│   │   │   │   ├── CompetitorCard.tsx
│   │   │   │   ├── FounderCard.tsx
│   │   │   │   ├── MarketCard.tsx
│   │   │   │   └── DealSummaryCard.tsx
│   │   │   ├── DeckUpload.tsx
│   │   │   ├── DealScorecard.tsx
│   │   │   ├── CompetitiveGraph.tsx    # D3 force-directed graph
│   │   │   ├── ClaimTracker.tsx
│   │   │   ├── DealChat.tsx
│   │   │   └── CopilotPopupChat.tsx
│   │   └── lib/
│   │       ├── types.ts
│   │       ├── api.ts
│   │       └── utils.ts
│   └── package.json
├── docs/
│   └── memgraph-railway-option-b.md    # Memgraph on Railway guide
├── docker-compose.yml                  # Memgraph container (optional)
├── .env.example
└── README.md
```

## Setup Instructions

### Prerequisites

- **Python 3.11+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **Tavily API key** (free) — [Get key](https://tavily.com)
- **Groq API key** (free) — [Get key](https://console.groq.com/keys)

### Step 1: Clone and Configure

```bash
git clone <repository-url>
cd dealgraph
cp .env.example backend/.env
```

Edit `backend/.env` — set at minimum:

```
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
TAVILY_API_KEY=tvly-your_key_here
```

### Step 2: Backend

```bash
cd backend
python -m venv venv
# Windows: venv\Scripts\activate
# macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Step 3: Frontend

```bash
cd frontend
npm install
npm run dev
```

### Step 4: Access

| Service           | URL                          |
| ----------------- | ---------------------------- |
| Frontend          | http://localhost:3000         |
| Backend API       | http://localhost:8000         |
| API Documentation | http://localhost:8000/docs    |

### Optional: Memgraph

For graph-backed verification of known companies:

```bash
docker compose up memgraph -d
python seed_memgraph.py
```

Then add to `backend/.env`:

```
MEMGRAPH_URI=bolt://localhost:7687
```

## Environment Variables

| Variable           | Required | Description                                        |
| ------------------ | -------- | -------------------------------------------------- |
| `LLM_PROVIDER`     | Yes      | `groq`, `ollama`, `together`, or `openai`          |
| `GROQ_API_KEY`     | If Groq  | Groq Cloud API key                                 |
| `TAVILY_API_KEY`   | Yes      | Tavily web search API key                          |
| `MEMGRAPH_URI`     | No       | Bolt URI for Memgraph (e.g. `bolt://localhost:7687`) |
| `EDGE_TTS_VOICE`   | No       | TTS voice (default: `en-US-GuyNeural`)             |
| `NEXT_PUBLIC_API_URL` | No    | Backend URL for frontend (default: `http://localhost:8000`) |
| **Telemetry**      |          | Optional observability                             |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | No | SigNoz: OTLP endpoint (e.g. `https://ingest.us.signoz.cloud:443`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | No | SigNoz: e.g. `signoz-ingestion-key=<key>`          |
| `LANGFUSE_SECRET_KEY` | No   | Langfuse: LLM tracing (Groq/Together/OpenAI)       |
| `LANGFUSE_PUBLIC_KEY` | No   | Langfuse: public key                               |
| `LANGFUSE_BASE_URL` | No      | Langfuse server (default: `https://cloud.langfuse.com`) |

## How It Works

```
PitchDeck (PDF/text)
       |
       v
 ClaimExtractor         — pulls 5-15 verifiable claims
       |
       v
   ClaimRouter           — classifies each claim
       |
       +-- factual_static  --> GraphResolver --> Evidence
       |                        (Memgraph, if connected)
       |
       +-- factual_dynamic --> WebResolver   --> Evidence
       |                        (Tavily live search)
       |
       +-- qualitative     --> LLMJudge     --> Evidence
       |                        (LLM reasoning)
       |
       +-- unverifiable    --> Flag
       |
       v
 EvidenceNormalizer      — adds: source, freshness, confidence (0.0-1.0)
       |
       v
    DealScorer           — confidence-weighted scoring
       |                    Team 30% | Market 25% | Traction 20%
       |                    Competition 15% | Financials 10%
       v
    MemoWriter           — investment memo + 60-90s voice briefing
```

### Scoring Logic

| Evidence Status | Confidence | Effect on Score                              |
| --------------- | ---------- | -------------------------------------------- |
| Verified        | > 0.7      | Full weight                                  |
| Verified        | 0.4 - 0.7  | Proportional weight                          |
| Unverified      | Low        | Docked 1-2 points for lack of transparency   |
| Contradicted    | High       | Actively reduces score (2-4 range)           |
| Flagged         | N/A        | Noted but not penalized (projections)        |

## API Endpoints

| Endpoint            | Method | Description                            |
| ------------------- | ------ | -------------------------------------- |
| `/api/health`       | GET    | Health check                           |
| `/api/analyze`      | POST   | Run full analysis pipeline             |
| `/api/extract-pdf`  | POST   | Extract text from uploaded PDF         |
| `/api/audio/{file}` | GET    | Serve generated audio files            |
| `/copilotkit`       | POST   | CopilotKit AG-UI streaming endpoint    |

## Telemetry (optional)

DealGraph supports two optional observability integrations:

- **SigNoz** — Application performance and distributed tracing (OpenTelemetry). Set `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` and optionally `OTEL_EXPORTER_OTLP_HEADERS` (e.g. `signoz-ingestion-key=<key>` for SigNoz Cloud). FastAPI requests are auto-instrumented.
- **Langfuse** — LLM observability (prompts, completions, token usage, latency). Set `LANGFUSE_SECRET_KEY` and `LANGFUSE_PUBLIC_KEY`. The backend patches the OpenAI-compatible client at startup, so all Groq, Together, and OpenAI calls are traced. Ollama runs are not traced.

Both are no-ops when the corresponding env vars are unset. See `.env.example` for full variable names.

## Deployment

### Backend on Railway

See the [Railway deployment guide](docs/memgraph-railway-option-b.md) for step-by-step instructions. Key environment variables to set:

```
LLM_PROVIDER=groq
GROQ_API_KEY=<your key>
TAVILY_API_KEY=<your key>
CORS_ORIGINS=https://your-frontend.vercel.app
```

### Frontend on Vercel

1. Import the repo on [Vercel](https://vercel.com)
2. Set root directory to `frontend`
3. Add environment variable: `NEXT_PUBLIC_API_URL=https://your-backend.railway.app`
4. Deploy

## Troubleshooting

**Problem**: `TAVILY_API_KEY` not set — web verification returns empty results

**Solution**: Get a free key at [tavily.com](https://tavily.com) and add it to `.env`

---

**Problem**: LLM returns malformed JSON — claims/scores are empty

**Solution**: Switch to a larger model. Groq's `llama-3.3-70b-versatile` is recommended for reliable structured output.

---

**Problem**: Memgraph connection refused

**Solution**: Memgraph is optional. Remove `MEMGRAPH_URI` from `.env` to skip graph queries entirely. The pipeline will use web search instead.

---

**Problem**: CORS errors in production

**Solution**: Set `CORS_ORIGINS=https://your-frontend-domain.com` in the backend environment variables.

---

**Problem**: Audio not playing

**Solution**: Ensure `edge-tts` is installed (`pip install edge-tts`). The backend generates a fallback audio file if TTS fails.

## License

MIT License
