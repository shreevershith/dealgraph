# DealGraph Backend

FastAPI backend for the DealGraph AI due diligence pipeline (Strands Agents + Bedrock + Neo4j + MiniMax TTS + Datadog).

## Setup (already done)

- `.env` is in this directory with AWS, Neo4j, MiniMax, and Datadog credentials.
- Virtualenv: `venv/` with dependencies from `requirements.txt`.

## Run the API

```powershell
cd dealgraph-backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --reload --port 8000
```

Then open http://localhost:8000/api/health — should return `{"status":"ok"}`.

## Neo4j seed data (required)

Before full pipeline runs, load the graph in **Neo4j AuraDB**:

1. Open your AuraDB instance → **Query** tab.
2. Run the scripts in **`neo4j_seed_scripts.cypher`** (at repo root) **in order**: Script 1, then 2, then 3a–3c, 4, 5, 6, 7a–7d.
3. Run the Script 8 verification queries and confirm results match the comments.

## Endpoints

- `GET /api/health` — Health check.
- `POST /api/analyze` — Body: `{"deck_text": "..."}`. Runs full pipeline, returns claims, score, memo, audio_url, competitors.
- `GET /api/audio/{filename}` — Serves generated memo MP3s.

## Fallback

If the pipeline or any service fails, the API returns the structured fallback in `fallback_response.json` so the frontend always gets a valid response.

## Troubleshooting

**`InvalidSignatureException` when calling Bedrock**  
The AWS Secret Access Key in `.env` is wrong (typo, truncated, or pasted with an extra character). Fix:

1. In **AWS Console** go to **IAM → Users →** your user **→ Security credentials**.
2. Under **Access keys**, create a **Create access key** (or use an existing one and copy the **Secret access key** again).
3. Update `dealgraph-backend/.env` and project root `.env`:
   - `AWS_SECRET_ACCESS_KEY="your-secret-key-here"`  
   Use double quotes if the key contains `+` or other special characters.
4. Restart the server and run the pipeline again (e.g. `python test_analyze.py` with the server running).
