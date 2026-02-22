# DealGraph

AI-powered due diligence copilot for investors. Upload a pitch deck, get AI-driven claim extraction, fact-checking against a knowledge graph, deal scoring, and an audio investment memo — with an interactive CopilotKit chat experience.

## Table of Contents

- [Overview](#overview)
- [Hackathon Build (Original Stack)](#hackathon-build-original-stack)
- [Open-Source Migration](#open-source-migration)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Deploy Backend on Railway](#deploy-backend-on-railway-step-by-step)
- [Deploy Frontend on Vercel](#deploy-frontend-on-vercel)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## Overview

DealGraph is a full-stack application that helps investors run due diligence on pitch decks:

- **Frontend (Next.js):** Deck upload (text or PDF), deal scorecard, competitive graph, claim tracker, and CopilotKit-powered chat.
- **Backend (FastAPI):** Multi-agent pipeline using Strands Agents, a graph database for knowledge-graph fact-checking, and text-to-speech for audio memos.

### Key Features

- **Deck analysis:** Paste deck text or upload PDF; pipeline extracts claims, scores the deal, and produces a memo.
- **Claim extraction & fact-checking:** Agents verify claims against a graph database (competitors, founders, market data).
- **Deal scorecard:** Structured score and evidence for quick review.
- **Competitive graph:** Visualize competitors and relationships with D3.js.
- **Audio memo:** Text-to-speech generates an MP3 summary.
- **CopilotKit chat:** AG-UI-compatible chat backed by Strands agents for follow-up questions.

---

## Hackathon Build (Original Stack)

This project was originally built during a hackathon using the following cloud/paid services. The commented-out code in each file shows exactly how these were integrated:

| Service | What We Used | Purpose |
|---------|-------------|---------|
| **AWS Bedrock** | Claude Sonnet 4 (`us.anthropic.claude-sonnet-4-20250514-v1:0`) | LLM powering all 5 agents (orchestrator, claim extractor, fact checker, deal scorer, memo writer) and the CopilotKit chat agent |
| **Neo4j AuraDB** | Cloud-managed graph database (free tier) | Knowledge graph storing companies, founders, markets, investors, funding rounds, and competitive relationships — used for fact-checking pitch deck claims |
| **Datadog** | LLMObs (LLM Observability via `ddtrace`) | Tracing agent calls, LLM token usage, tool invocations, and latency metrics in real time |
| **MiniMax** | `speech-02-turbo` TTS API | Generating audio investment memo MP3 files from the written memo text |
| **Strands Agents** | AWS open-source agent framework | Multi-agent orchestration with tool calling (this is still used — it supports multiple model backends) |
| **CopilotKit** | AG-UI protocol via `ag-ui-strands` | Interactive chat sidebar with generative UI cards for tool call results |

All original integration code is preserved as comments (marked with `HACKATHON BUILD`) in each source file so you can see exactly what was used and how.

---

## Open-Source Migration

We migrated to a fully open-source / free stack so the project can run without any paid API credits:

| Hackathon (Paid) | Open-Source (Free) | Migration Effort | Notes |
|---|---|---|---|
| **AWS Bedrock** (Claude Sonnet 4) | **Ollama** (local) or **Groq** (free hosted Llama 3.3 70B) | Medium | Same Strands Agents framework — `model_config.py` abstracts the provider. Set `LLM_PROVIDER` env var to switch between `ollama`, `groq`, `together`, or `openai`. |
| **Neo4j AuraDB** | **Memgraph** (self-hosted via Docker) | Very Low | Memgraph speaks the same Bolt protocol and Cypher query language. Same `neo4j` Python driver, same queries — zero code changes to Cypher. |
| **Datadog LLMObs** | Removed (commented out) | None | Observability was optional. Add OpenTelemetry + Langfuse later if needed. |
| **MiniMax TTS** | **edge-tts** (free Microsoft Edge TTS) | Low | Single file change. No API key needed, produces MP3 directly. |

### LLM Provider Options

| Provider | `LLM_PROVIDER` | Best For | Cost | Setup |
|---|---|---|---|---|
| **Ollama** | `ollama` | Local development, offline use | Free (your hardware) | `ollama pull llama3.3` |
| **Groq** | `groq` | Production deployment (recommended) | Free tier (generous rate limits) | Get API key at [console.groq.com](https://console.groq.com/keys) |
| **Together.ai** | `together` | Production (alternative) | Free credits on signup | Get API key at [together.ai](https://www.together.ai/) |
| **OpenAI** | `openai` | If you want GPT-4o | Paid | Get API key at [platform.openai.com](https://platform.openai.com/) |

---

## Tech Stack

### Current (Open-Source)

- **Backend:** Python 3.10+ with FastAPI, Strands Agents, ag-ui-strands (CopilotKit bridge)
- **Frontend:** Next.js 14, React 18, Tailwind CSS, CopilotKit, D3.js, shadcn/ui (Radix)
- **LLM:** Ollama (local) or Groq/Together.ai (free hosted) — configurable via `LLM_PROVIDER`
- **Graph DB:** Memgraph (Cypher-compatible, self-hosted via Docker)
- **TTS:** edge-tts (free, no API key)
- **PDF:** PyPDF2

### Hackathon (Original)

- **LLM:** AWS Bedrock — Claude Sonnet 4
- **Graph DB:** Neo4j AuraDB (cloud)
- **TTS:** MiniMax API (`speech-02-turbo`)
- **Observability:** Datadog LLMObs (`ddtrace`)

## Project Structure

```
dealgraph/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, /api/analyze, /copilotkit, /api/audio
│   ├── requirements.txt           # Python dependencies
│   ├── model_config.py            # LLM provider factory (Ollama / Groq / Together / OpenAI)
│   ├── seed_memgraph.py           # Seed script to populate Memgraph with VC knowledge graph
│   ├── agents/
│   │   ├── orchestrator.py        # Pipeline orchestration (Ollama)
│   │   ├── claim_extractor.py     # Extract claims from deck text (Ollama)
│   │   ├── fact_checker.py        # Verify claims via Memgraph (Ollama)
│   │   ├── deal_scorer.py         # Score deal (Ollama)
│   │   ├── memo_writer.py         # Write memo + edge-tts (Ollama)
│   │   └── shared_state.py        # Shared state across agents
│   └── tools/
│       ├── neo4j_tools.py         # Graph DB queries (works with Memgraph via Bolt protocol)
│       ├── deck_parser.py         # Deck/PDF parsing
│       └── minimax_tts.py         # TTS (now uses edge-tts, MiniMax code commented out)
├── frontend/
│   ├── package.json               # Node.js dependencies
│   ├── vercel.json                # Vercel config (Next.js, build command)
│   ├── next.config.mjs            # Next.js config
│   └── src/
│       ├── app/
│       │   ├── layout.tsx         # Root layout
│       │   ├── page.tsx           # Main dashboard
│       │   ├── chat/page.tsx      # Chat page
│       │   ├── providers.tsx      # CopilotKit + API URL
│       │   └── globals.css        # Global styles
│       ├── components/
│       │   ├── DeckUpload.tsx     # Deck input (text/PDF)
│       │   ├── DealScorecard.tsx  # Score display
│       │   ├── CompetitiveGraph.tsx # D3 competitive graph
│       │   ├── ClaimTracker.tsx   # Claims list
│       │   ├── DealChat.tsx       # Chat UI
│       │   ├── CopilotPopupChat.tsx # Popup chat
│       │   └── ui/               # shadcn/ui components
│       └── lib/
│           ├── api.ts             # analyzeDeck, resolveAudioUrl
│           ├── types.ts           # TypeScript types
│           └── utils.ts           # Utilities
├── docker-compose.yml             # Memgraph container
├── .env.example                   # Environment variables template
└── README.md                      # This file
```

## Setup Instructions

### Prerequisites

- **Python 3.10 or higher** — [Download Python](https://www.python.org/downloads/)
- **Node.js 18 or higher** — [Download Node.js](https://nodejs.org/)
- **Docker** — [Download Docker](https://www.docker.com/products/docker-desktop/) (for Memgraph)
- **Ollama** — [Download Ollama](https://ollama.com/download) (for local LLM inference)

### Step 1: Clone the Repository

```bash
git clone https://github.com/shreevershith/dealGraph.git
cd dealGraph
```

### Step 2: Start Memgraph (Graph Database)

```bash
docker compose up memgraph -d
```

This starts Memgraph on port `7687` (Bolt) and Memgraph Lab (web UI) on port `3000`.

You can access Memgraph Lab at http://localhost:3000 to explore the graph visually (change to port `7444` if `3000` conflicts with your Next.js dev server).

### Step 3: Choose an LLM Provider

You have two options:

**Option A: Ollama (local, fully offline)**

Download Ollama from [ollama.com](https://ollama.com/download), then:

```bash
# Pull a model (pick based on your hardware)
ollama pull llama3.3        # 70B — best quality, needs ~40GB RAM/VRAM
# OR
ollama pull qwen2.5:14b     # 14B — good balance, needs ~10GB
# OR
ollama pull llama3.1:8b     # 8B — lightest, needs ~5GB

# Ollama serves automatically after pull, but you can explicitly start:
ollama serve
```

**Option B: Groq (recommended for deployment — free, no GPU needed)**

1. Sign up at [console.groq.com](https://console.groq.com/)
2. Create an API key at [console.groq.com/keys](https://console.groq.com/keys)
3. That's it — Groq hosts Llama 3.3 70B for free with generous rate limits

### Step 4: Configure Environment Variables

```bash
copy .env.example .env
```

**For Ollama (local dev):**
```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.3
```

**For Groq (deployment / no GPU):**
```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here
GROQ_MODEL=llama-3.3-70b-versatile
```

Both options also need:
```env
MEMGRAPH_URI=bolt://localhost:7687
EDGE_TTS_VOICE=en-US-GuyNeural
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Step 5: Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed Memgraph with the VC knowledge graph data
python seed_memgraph.py

# Start the backend server
python main.py
# Or: uvicorn main:app --reload --port 8000
```

The backend will start on `http://localhost:8000`.

### Step 6: Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server (use port 3001 if Memgraph Lab is on 3000)
npx next dev -p 3001
# Or if Memgraph Lab is not running on 3000:
npm run dev
```

### Step 7: Access the Application

- **Frontend:** http://localhost:3001 (or http://localhost:3000)
- **Backend API:** http://localhost:8000
- **API health:** http://localhost:8000/api/health
- **Memgraph Lab:** http://localhost:3000 (if not using for frontend)

## Memgraph Knowledge Graph (Seed Data)

The backend uses a graph database (Memgraph) as a VC knowledge graph for fact-checking pitch deck claims. The seed script (`backend/seed_memgraph.py`) populates it with **generalized data across multiple domains**. Market TAM and growth figures are aligned to publicly cited sources (e.g. MarketsandMarkets, Statista, CDC/CMS, Crunchbase) so the fact-checker can verify common pitch deck claims.

### Graph Schema

```
(:Company)  -[:OPERATES_IN]->  (:Market)
(:Company)  -[:COMPETES_WITH]-> (:Company)
(:Company)  -[:FOUNDED_BY]->   (:Person)
(:Person)   -[:PREVIOUSLY_AT]-> (:Company)
(:FundingRound) -[:RAISED_BY]-> (:Company)
(:Investor) -[:LED_ROUND]->    (:FundingRound)
```

### Seeded Data Summary (Expanded)

| Node Type | Count | Examples |
|-----------|-------|----------|
| **Market** | 7 | Digital Payments ($50B), AI Infrastructure ($30B), Developer Tools ($20B), Digital Health ($600B by 2030, ~20% CAGR), Health & Fitness Apps ($94B), Cybersecurity ($40B), Enterprise Automation ($120B) |
| **Company** | 26 | Stripe, Brex, Ramp, Acme Payments (fintech); OpenAI, Anthropic, Scale AI (AI); Vercel, Supabase (dev tools); VitalQuest, Duolingo, Peloton, Noom, Headspace (digital health / health & fitness); UiPath, Automation Anywhere (enterprise automation); Apple |
| **Person** | 15 | Founders for Acme, Stripe, Square, OpenAI, Anthropic, Duolingo, Peloton, Noom, Headspace, UiPath, Automation Anywhere, VitalQuest |
| **Investor** | 6 | Sequoia Capital, Andreessen Horowitz, Accel, Thrive Capital, Google Ventures, General Catalyst |
| **FundingRound** | 6 | Stripe, Checkout.com, Plaid, Anthropic, Acme Payments, VitalQuest |

Market descriptions include key stats (e.g. US healthcare spending, chronic disease, smartphone users) so the fact-checker can cite them when verifying claims.

### How It Works

When you upload a pitch deck, the analysis pipeline:
1. Extracts the company name from the PDF text
2. Queries Memgraph to find competitors in the same market (via `OPERATES_IN` relationships)
3. Verifies founder backgrounds (via `PREVIOUSLY_AT` relationships)
4. Checks market TAM/growth claims against stored market data

### Seeding Commands

```bash
# Make sure Memgraph is running
docker compose up memgraph -d

# Seed the knowledge graph
cd backend
python seed_memgraph.py
```

The seed script **clears all existing data** and re-inserts everything, so it's safe to re-run after pulling updates or changing domains.

### Adding Your Own Data

To add more companies/markets to the knowledge graph, you can either:
- Edit `backend/seed_memgraph.py` and re-run it
- Connect to Memgraph Lab at `http://localhost:3000` and run Cypher queries directly

Example — adding a new company and linking it to a market:
```cypher
CREATE (:Company {name: "NewCo", stage: "Series A", total_raised: 10000000, employee_count: 50});
MATCH (c:Company {name: "NewCo"}), (m:Market {name: "AI Infrastructure"})
CREATE (c)-[:OPERATES_IN]->(m);
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_PROVIDER` | LLM provider: `ollama`, `groq`, `together`, `openai` | `ollama` |
| `OLLAMA_HOST` | Ollama server URL (when `LLM_PROVIDER=ollama`) | `http://localhost:11434` |
| `OLLAMA_MODEL` | Model name in Ollama | `llama3.3` |
| `GROQ_API_KEY` | Groq API key (when `LLM_PROVIDER=groq`) | — |
| `GROQ_MODEL` | Groq model name | `llama-3.3-70b-versatile` |
| `TOGETHER_API_KEY` | Together.ai API key (when `LLM_PROVIDER=together`) | — |
| `TOGETHER_MODEL` | Together model name | `meta-llama/Llama-3.3-70B-Instruct` |
| `MEMGRAPH_URI` | Memgraph Bolt connection URI | `bolt://localhost:7687` |
| `MEMGRAPH_USER` | Memgraph username (optional) | _(empty)_ |
| `MEMGRAPH_PASSWORD` | Memgraph password (optional) | _(empty)_ |
| `EDGE_TTS_VOICE` | edge-tts voice name | `en-US-GuyNeural` |
| | _CopilotKit is self-hosted via your backend's `/copilotkit` endpoint — no API key needed_ | |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (no trailing slash) | `http://localhost:8000` |
| `CORS_ORIGINS` | Comma-separated origins for CORS (production) | `*` (allow all) |

## Deploy Backend on Railway (Step-by-Step)

Follow these steps to host the DealGraph backend on [Railway](https://railway.app) so your Vercel frontend can call it.

### Step 1: Create a Railway account and project

1. Go to [railway.app](https://railway.app) and sign in (GitHub is easiest).
2. Click **New Project**.
3. Choose **Deploy from GitHub repo** and select your **dealgraph** repository (or fork).
4. When asked which repo to deploy, pick the repo and connect it.

### Step 2: Configure the backend service

1. After the repo is connected, Railway may create a service. If it created a service from the **root** of the repo, we need to point it at the backend only.
2. Open the new service → **Settings** (or the service’s **Settings** tab).
3. Find **Root Directory** (under “Build” or “Source”).
4. Set **Root Directory** to **`backend`** (no leading slash). This makes Railway build and run from the `backend/` folder where `main.py` and `requirements.txt` live.
5. **Build command:** leave default (Railway will detect Python and run `pip install -r requirements.txt`).
6. **Start command:** Railway will use the `Procfile` in `backend/` (`uvicorn main:app --host 0.0.0.0 --port $PORT`). If your start command is empty, set it to:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```

### Step 3: Add environment variables

In the same service, go to **Variables** and add:

| Variable | Value | Notes |
|----------|--------|--------|
| `LLM_PROVIDER` | `groq` | Use Groq for production (no GPU on Railway). |
| `GROQ_API_KEY` | `gsk_...` | From [console.groq.com/keys](https://console.groq.com/keys). |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` | Optional; this is the default. |
| `MEMGRAPH_URI` | Your Memgraph Bolt URL | See Step 4. |
| `MEMGRAPH_USER` | _(if required)_ | Leave blank for local Memgraph. |
| `MEMGRAPH_PASSWORD` | _(if required)_ | Leave blank for local Memgraph. |
| `EDGE_TTS_VOICE` | `en-US-GuyNeural` | Optional; default voice for audio memo. |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Your Vercel frontend URL (no trailing slash). Add multiple origins comma-separated if needed. |

Do **not** set `NEXT_PUBLIC_API_URL` on Railway; that belongs in **Vercel** and should be your Railway backend URL after deploy.

### Step 4: Memgraph for production

The backend needs a running Memgraph instance. Options:

- **Option A — Memgraph Cloud (recommended)**  
  1. Sign up at [memgraph.com/cloud](https://memgraph.com/cloud).  
  2. Create an instance and get the **Bolt URI** (e.g. `bolt+ssc://...memgraph.io:7687`) and username/password if required.  
  3. Set `MEMGRAPH_URI`, `MEMGRAPH_USER`, and `MEMGRAPH_PASSWORD` in Railway variables.  
  4. After the instance is ready, run the seed script once against this URI (from your machine or a one-off script) so the graph has data.

- **Option B — Memgraph on Railway**  
  Add another service in the same project that runs Memgraph (e.g. from a Dockerfile or a public Memgraph image), expose its Bolt port, and set `MEMGRAPH_URI` to that service’s internal URL (e.g. `bolt://memgraph:7687`). Then run the seed from your laptop with `MEMGRAPH_URI` pointing at the public URL of that service, or run the seed as a one-off job.

### Step 5: Deploy and get the backend URL

1. Save settings and trigger a deploy (or push to the connected branch).
2. In the service, open **Settings** → **Networking** (or **Generate domain**) and add a **public domain** (e.g. `your-service.railway.app`).
3. Copy the full URL (e.g. `https://your-service.railway.app`). You will use this in Vercel.

### Step 6: Point Vercel at the backend

1. In your **Vercel** project → **Settings** → **Environment Variables**, set:
   - **Name:** `NEXT_PUBLIC_API_URL`  
   - **Value:** `https://your-service.railway.app` (your Railway backend URL, **no trailing slash**).
2. Redeploy the Vercel frontend so it picks up the new variable.

### Step 7: Verify

- Open `https://your-service.railway.app/api/health` — it should return `{"status":"ok"}`.
- Use your Vercel app: upload a deck and run analysis. If the frontend still shows errors, check browser devtools and that `CORS_ORIGINS` on Railway includes your Vercel URL.

---

**Summary:** Root Directory = `backend`, set env vars (Groq + Memgraph + CORS), add a public domain, then set `NEXT_PUBLIC_API_URL` in Vercel to that domain.

## Deploy Frontend on Vercel

The repo is a **monorepo**: the Next.js app lives in the `frontend/` folder. Only the frontend is deployed to Vercel; the backend must be hosted elsewhere (Railway, Render, Fly.io, etc.) and its URL is set in `NEXT_PUBLIC_API_URL`.

### How to Connect to Vercel and Deploy

1. **Sign in to Vercel**
   Go to [vercel.com](https://vercel.com) and sign in with GitHub, GitLab, or Bitbucket.

2. **Import the repository**
   - Click **Add New...** → **Project**.
   - Select your Git provider and choose the **dealGraph** repository.
   - Click **Import**.

3. **Set the Root Directory**
   - Before deploying, open **Project Settings** (or the configuration step during import).
   - Find **Root Directory**.
   - Click **Edit** and set it to **`frontend`** (no leading slash).
   - Save. This tells Vercel to run `npm install` and `npm run build` inside `frontend/`.

4. **Add environment variables**
   - In the project, go to **Settings** → **Environment Variables**.
   - Add:
     - **Name:** `NEXT_PUBLIC_API_URL`
     - **Value:** Your backend URL (e.g. `https://your-backend.railway.app`) — **no trailing slash**.
   - Select **Production** (and optionally **Preview** / **Development** if you use different API URLs).
   - Save.

5. **Deploy**
   - Click **Deploy** (or push to the connected branch).
   - Wait for the build to finish.
   - Your app will be live at `https://your-project.vercel.app`.

### Backend Hosting (Required for Full App)

Host the `backend/` on a platform that runs Python (e.g. **Railway**, **Render**, **Fly.io**, or a VPS). Ensure:

- The backend is reachable over **HTTPS**.
- CORS allows your Vercel frontend origin (already configured in `backend/main.py`).
- LLM is accessible — use `LLM_PROVIDER=groq` with `GROQ_API_KEY` for easiest deployment (no GPU needed).
- Memgraph is accessible from the backend (either co-located or via `MEMGRAPH_URI`).

Then use that backend URL as `NEXT_PUBLIC_API_URL` in Vercel.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check. Returns `{"status":"ok"}`. |
| `/api/analyze` | POST | Body: `{"deck_text": "..."}`. Runs full pipeline; returns claims, score, memo, audio_url, competitors. |
| `/api/extract-pdf` | POST | Upload a PDF file. Returns extracted text. |
| `/api/audio/{filename}` | GET | Serves generated memo MP3 files. |
| `/copilotkit` | POST | CopilotKit AG-UI endpoint (info + agent runs via ag_ui_strands). |

## Troubleshooting

### Ollama Issues

**Problem:** `ConnectionError` or agents failing to generate responses
- **Solution:** Ensure Ollama is running (`ollama serve`) and the model is pulled (`ollama list`). Check `OLLAMA_HOST` and `OLLAMA_MODEL` in `.env`.

**Problem:** Slow responses or out-of-memory errors
- **Solution:** Use a smaller model. `llama3.1:8b` or `qwen2.5:7b` need ~5GB RAM. `llama3.3` (70B) needs ~40GB. Set `OLLAMA_MODEL` in `.env` to your chosen model.

**Problem:** Structured JSON output is malformed
- **Solution:** Larger models produce better structured output. If using an 8B model, try upgrading to 14B+. The pipeline has fallback parsing to handle common formatting issues.

### Memgraph Issues

**Problem:** `ServiceUnavailable` or graph queries returning empty results
- **Solution:** Ensure Memgraph is running (`docker compose up memgraph -d`) and seed data is loaded (`python seed_memgraph.py`). Check `MEMGRAPH_URI` in `.env`.

**Problem:** Constraint errors during seeding
- **Solution:** The seed script clears all data first. If you get constraint errors, the data was already seeded. Run `python seed_memgraph.py` again to reset.

### Frontend Issues

**Problem:** Frontend cannot reach the API (CORS or network errors)
- **Solution:** Ensure the backend is running and `NEXT_PUBLIC_API_URL` matches the backend URL (no trailing slash). For local dev, use `http://localhost:8000`.

**Problem:** Port 3000 conflict between Memgraph Lab and Next.js
- **Solution:** Run Next.js on a different port: `npx next dev -p 3001` and update your browser URL accordingly.

**Problem:** Vercel build fails
- **Solution:** Confirm **Root Directory** is set to **`frontend`** in Vercel project settings. Ensure `npm run build` succeeds locally from the `frontend/` folder.

**Problem:** Chat or CopilotKit not working in production
- **Solution:** Verify `NEXT_PUBLIC_API_URL` in Vercel points to the deployed backend and that the backend's `/copilotkit` route is reachable.

### TTS Issues

**Problem:** Audio memo not generating (returns fallback)
- **Solution:** Ensure `edge-tts` is installed (`pip install edge-tts`). Test with: `python -m edge_tts --text "Hello" --write-media test.mp3`. The machine needs internet access for edge-tts.

## Deployment & Observability (Next Steps)

### Railway (Backend)

**Yes, you can start now.** Deploy the `backend/` to Railway:

1. Create a project and connect your repo; set the **root directory** to `backend` (or use a Dockerfile in `backend/`).
2. Add env vars: `LLM_PROVIDER=groq`, `GROQ_API_KEY`, `MEMGRAPH_URI` (see below), `EDGE_TTS_VOICE`, `CORS_ORIGINS` (your Vercel URL).
3. For **Memgraph in production**: either use [Memgraph Cloud](https://memgraph.com/cloud) (managed) and set `MEMGRAPH_URI` + auth, or run Memgraph in a separate Railway service / Docker and set `MEMGRAPH_URI` to that service’s URL.

Once the backend is live, set `NEXT_PUBLIC_API_URL` in Vercel to the Railway backend URL.

### SigNoz & Langfuse (Observability)

**Yes, you can start now**, but they are optional and require adding instrumentation:

- **SigNoz** — APM and metrics. Add OpenTelemetry (e.g. `opentelemetry-api`, `opentelemetry-sdk`, exporter to SigNoz) to the FastAPI app and to Strands/LLM calls so traces and metrics are sent to your SigNoz instance.
- **Langfuse** — LLM observability (tracing, cost, latency). Add the Langfuse SDK and instrument your LLM provider (or use Langfuse’s OpenAI integration if you use an OpenAI-compatible client). The current code has no observability hooks; adding them is a small, non-blocking change.

Recommended order: get **Railway + Vercel** working first with Groq and Memgraph (or Memgraph Cloud). Then add **SigNoz** for infra/API traces and **Langfuse** for LLM traces when you want visibility.

## License

MIT License.
