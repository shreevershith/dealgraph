# DealGraph

AI-powered due diligence copilot for investors. Upload a pitch deck, get AI-driven claim extraction, fact-checking against a knowledge graph, deal scoring, and an audio investment memo—with an interactive CopilotKit chat experience.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [Deploy Frontend on Vercel](#deploy-frontend-on-vercel)
- [API Endpoints](#api-endpoints)
- [Troubleshooting](#troubleshooting)

## Overview

DealGraph is a full-stack application that helps investors run due diligence on pitch decks:

- **Frontend (Next.js):** Deck upload (text or PDF), deal scorecard, competitive graph, claim tracker, and CopilotKit-powered chat.
- **Backend (FastAPI):** Multi-agent pipeline using Strands Agents on AWS Bedrock, Neo4j for knowledge-graph fact-checking, and MiniMax for text-to-speech memos.

The frontend can be deployed to **Vercel**; the backend must be hosted separately (e.g. Railway, Render, or AWS).

### Key Features

- **Deck analysis:** Paste deck text or upload PDF; pipeline extracts claims, scores the deal, and produces a memo.
- **Claim extraction & fact-checking:** Agents verify claims against a Neo4j graph (competitors, founders, market data).
- **Deal scorecard:** Structured score and evidence for quick review.
- **Competitive graph:** Visualize competitors and relationships.
- **Audio memo:** MiniMax TTS generates an MP3 summary.
- **CopilotKit chat:** AG-UI–compatible chat backed by Strands agents for follow-up questions.
- **Fallback response:** If the pipeline or any service fails, the API returns a structured fallback so the frontend always gets a valid response.

## Tech Stack

- **Backend:** Python 3.10+ with FastAPI, Strands Agents, ag-ui-strands (CopilotKit bridge)
- **Frontend:** Next.js 14, React 18, Tailwind CSS, CopilotKit, D3.js, shadcn/ui (Radix)
- **AI/LLM:** AWS Bedrock (via Strands)
- **Graph DB:** Neo4j (AuraDB or self-hosted)
- **TTS:** MiniMax API
- **Observability:** Datadog LLMObs (optional)
- **PDF:** PyPDF2

## Project Structure

```
dealGraph/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, /api/analyze, /copilotkit, /api/audio
│   ├── requirements.txt          # Python dependencies
│   ├── agents/
│   │   ├── orchestrator.py       # Pipeline orchestration
│   │   ├── claim_extractor.py    # Extract claims from deck text
│   │   ├── fact_checker.py       # Verify claims via Neo4j
│   │   ├── deal_scorer.py        # Score deal
│   │   ├── memo_writer.py        # Write memo + MiniMax TTS
│   │   └── shared_state.py       # Shared state across agents
│   └── tools/
│       ├── neo4j_tools.py        # Neo4j queries (competitors, founders, market)
│       ├── deck_parser.py        # Deck/PDF parsing
│       └── minimax_tts.py        # MiniMax text-to-speech
├── frontend/
│   ├── package.json              # Node.js dependencies
│   ├── vercel.json               # Vercel config (Next.js, build command)
│   ├── next.config.mjs            # Next.js config
│   └── src/
│       ├── app/
│       │   ├── layout.tsx        # Root layout
│       │   ├── page.tsx          # Main dashboard
│       │   ├── chat/page.tsx     # Chat page
│       │   ├── providers.tsx     # CopilotKit + API URL
│       │   └── globals.css       # Global styles
│       ├── components/
│       │   ├── DeckUpload.tsx    # Deck input (text/PDF)
│       │   ├── DealScorecard.tsx # Score display
│       │   ├── CompetitiveGraph.tsx # D3 competitive graph
│       │   ├── ClaimTracker.tsx  # Claims list
│       │   ├── DealChat.tsx     # Chat UI
│       │   ├── CopilotPopupChat.tsx # Popup chat
│       │   └── ui/              # shadcn/ui components
│       └── lib/
│           ├── api.ts            # analyzeDeck, resolveAudioUrl
│           ├── types.ts          # TypeScript types
│           └── utils.ts          # Utilities
├── .env.example                  # Environment variables template
└── README.md                     # This file
```

## Setup Instructions

### Prerequisites

- **Python 3.10 or higher** — [Download Python](https://www.python.org/downloads/)
- **Node.js 18 or higher** — [Download Node.js](https://nodejs.org/)
- **AWS account** (for Bedrock) — [AWS Console](https://console.aws.amazon.com/)
- **Neo4j AuraDB or Neo4j instance** — [Neo4j Aura](https://neo4j.com/cloud/aura/) (free tier available)
- **MiniMax API key** (for TTS) — [MiniMax](https://www.minimax.com/)
- **CopilotKit API key** (for chat) — [CopilotKit](https://www.copilotkit.ai/)

### Step 1: Clone the Repository

```bash
git clone https://github.com/shreevershith/dealGraph.git
cd dealGraph
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` in the **project root** and in the **backend** directory. Fill in:

- **AWS:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
- **Neo4j:** `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`
- **MiniMax:** `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`
- **CopilotKit:** `COPILOTKIT_API_KEY`
- **Frontend (local):** `NEXT_PUBLIC_API_URL=http://localhost:8000` (optional; this is the default)

See [Environment Variables](#environment-variables) for a full table.

### Step 3: Backend Setup

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

# Start the backend server
python main.py
# Or: uvicorn main:app --reload --port 8000
```

The backend will start on `http://localhost:8000`.

### Step 4: Frontend Setup

Open a new terminal:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will start on `http://localhost:3000`.

### Step 5: Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **API health:** http://localhost:8000/api/health

Before running full pipeline flows, load Neo4j seed data as described in `backend/README.md`.

## Environment Variables

| Variable | Description | Where | Example |
|----------|-------------|--------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key for Bedrock | Backend | — |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Backend | — |
| `AWS_REGION` | AWS region for Bedrock | Backend | `us-east-1` |
| `NEO4J_URI` | Neo4j connection URI | Backend | `neo4j+s://xxx.databases.neo4j.io` |
| `NEO4J_USERNAME` | Neo4j user | Backend | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j password | Backend | — |
| `MINIMAX_API_KEY` | MiniMax API key (TTS) | Backend | — |
| `MINIMAX_GROUP_ID` | MiniMax group ID | Backend | — |
| `COPILOTKIT_API_KEY` | CopilotKit API key | Backend / Frontend (if needed) | — |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (no trailing slash) | Frontend (Vercel + local) | `http://localhost:8000` or `https://your-api.railway.app` |
| `DD_API_KEY` | Datadog API key (optional) | Backend | — |
| `DD_SITE` | Datadog site (optional) | Backend | `datadoghq.com` |

## Deploy Frontend on Vercel

The repo is a **monorepo**: the Next.js app lives in the `frontend/` folder. Only the frontend is deployed to Vercel; the backend must be hosted elsewhere (Railway, Render, Fly.io, AWS, etc.) and its URL is set in `NEXT_PUBLIC_API_URL`.

### How to Connect to Vercel and Deploy

1. **Sign in to Vercel**  
   Go to [vercel.com](https://vercel.com) and sign in with GitHub, GitLab, or Bitbucket.

2. **Import the repository**  
   - Click **Add New…** → **Project**.  
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
     - **Value:** Your backend URL (e.g. `https://your-backend.railway.app` or `https://your-api.onrender.com`) — **no trailing slash**.  
   - Select **Production** (and optionally **Preview** / **Development** if you use different API URLs).  
   - Save.

5. **Deploy**  
   - Click **Deploy** (or push to the connected branch).  
   - Wait for the build to finish.  
   - Your app will be live at `https://your-project.vercel.app` (or your custom domain).

### After Connecting: Summary

| Step | Where in Vercel | What to do |
|------|------------------|------------|
| Connect repo | Add New → Project | Select **dealGraph** and import. |
| Root directory | Project Settings → General → Root Directory | Set to **`frontend`**. |
| API URL | Settings → Environment Variables | Add `NEXT_PUBLIC_API_URL` = your backend URL. |
| Deploy | Deployments / Git push | Build runs from `frontend/`; site goes live. |

### Backend Hosting (Required for Full App)

Host the `backend/` on a platform that runs Python (e.g. **Railway**, **Render**, **Fly.io**, or AWS). Ensure:

- The backend is reachable over **HTTPS**.
- CORS allows your Vercel frontend origin (already configured in `backend/main.py`).
- All required env vars (AWS, Neo4j, MiniMax, etc.) are set in the backend’s environment.

Then use that backend URL as `NEXT_PUBLIC_API_URL` in Vercel.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check. Returns `{"status":"ok"}`. |
| `/api/analyze` | POST | Body: `{"deck_text": "..."}`. Runs full pipeline; returns claims, score, memo, audio_url, competitors. |
| `/api/audio/{filename}` | GET | Serves generated memo MP3 files. |
| `/copilotkit` | — | CopilotKit AG-UI endpoint (info + agent runs via ag_ui_strands). |

See `backend/README.md` for Neo4j seed data and more details.

## Troubleshooting

### Backend Issues

**Problem:** `ModuleNotFoundError: No module named 'strands'` or `'ag_ui_strands'`  
- **Solution:** Install dependencies: `pip install -r requirements.txt`. The `requirements.txt` includes `strands-agents`, `strands-agents-tools`, and `ag-ui-strands`.

**Problem:** `InvalidSignatureException` when calling Bedrock  
- **Solution:** The AWS Secret Access Key in `.env` is wrong. In AWS Console → IAM → Users → your user → Security credentials, create or copy an access key and update `AWS_SECRET_ACCESS_KEY` in `.env`. Use double quotes if the key contains special characters. Restart the server.

**Problem:** Neo4j or pipeline errors  
- **Solution:** Ensure Neo4j is reachable and seed data is loaded as in `backend/README.md`. Check backend logs for details.

### Frontend Issues

**Problem:** Frontend cannot reach the API (CORS or network errors)  
- **Solution:** Ensure the backend is running and `NEXT_PUBLIC_API_URL` matches the backend URL (no trailing slash). For local dev, use `http://localhost:8000`.

**Problem:** Vercel build fails  
- **Solution:** Confirm **Root Directory** is set to **`frontend`** in Vercel project settings. Ensure `npm run build` succeeds locally from the `frontend/` folder.

**Problem:** Chat or CopilotKit not working in production  
- **Solution:** Verify `NEXT_PUBLIC_API_URL` in Vercel points to the deployed backend and that the backend’s `/copilotkit` route is reachable. Check CopilotKit and backend env vars.

## License

MIT License.
