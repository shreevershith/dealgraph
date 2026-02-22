import os
import sys
import asyncio
import json
import re
import time
import logging
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  HACKATHON BUILD — Datadog LLMObs (cloud observability)                    ║
# ║  We used Datadog's LLM Observability (ddtrace) during the hackathon to     ║
# ║  trace agent calls, LLM token usage, and tool invocations in real time.    ║
# ║  Required DD_API_KEY and DD_SITE env vars.                                 ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
# os.environ["DD_TRACE_OPENAI_AGENTS_ENABLED"] = "false"
# try:
#     import ddtrace
#     ddtrace.config._disabled_integrations.add("openai_agents")
# except Exception:
#     pass
# import logging as _lg
# _lg.getLogger("ddtrace").setLevel(_lg.CRITICAL)
# try:
#     from ddtrace.llmobs import LLMObs
#     LLMObs.enable(
#         ml_app="dealgraph",
#         api_key=os.getenv("DD_API_KEY"),
#         site=os.getenv("DD_SITE", "datadoghq.com"),
#         agentless_enabled=True,
#     )
# except Exception:
#     pass

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

load_dotenv()

from strands import Agent as StrandsNativeAgent, tool as strands_tool
from ag_ui_strands import StrandsAgent, StrandsAgentConfig
from ag_ui_strands.endpoint import EventEncoder, RunAgentInput

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  HACKATHON BUILD — AWS Bedrock (Claude Sonnet 4) for CopilotKit agent      ║
# ║  from strands.models.bedrock import BedrockModel as StrandsBedrockModel    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  OPEN-SOURCE VERSION — Supports Ollama (local) / Groq / Together.ai        ║
# ║  Set LLM_PROVIDER env var to switch. See model_config.py for details.      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
from model_config import get_model

logger = logging.getLogger("dealgraph")
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

AUDIO_DIR = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

_raw = os.getenv("CORS_ORIGINS", "*").strip()
CORS_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]
# When using "*", credentials must be False (CORS spec). When listing explicit origins, credentials can be True.
CORS_CREDENTIALS = "*" not in CORS_ORIGINS and len(CORS_ORIGINS) > 0

app = FastAPI(title="DealGraph API", redirect_slashes=False)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=CORS_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

MAX_DECK_TEXT_CHARS = 500_000
AUDIO_MAX_AGE_SECONDS = 3600


class AnalyzeRequest(BaseModel):
    deck_text: str

    @field_validator("deck_text")
    @classmethod
    def validate_deck_text(cls, v: str) -> str:
        if len(v) > MAX_DECK_TEXT_CHARS:
            raise ValueError(f"Pitch deck text exceeds maximum length ({MAX_DECK_TEXT_CHARS} chars)")
        if len(v.strip()) < 50:
            raise ValueError("Pitch deck text is too short for meaningful analysis")
        return v



def _cleanup_old_audio():
    """Remove generated audio files older than AUDIO_MAX_AGE_SECONDS."""
    cutoff = time.time() - AUDIO_MAX_AGE_SECONDS
    for f in AUDIO_DIR.iterdir():
        if f.suffix == ".mp3" and f.name != "fallback_memo.mp3":
            try:
                if f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
            except OSError:
                pass


def _parse_json_from_text(text: str):
    """Extract and parse JSON from agent output (may be wrapped in markdown or prose)."""
    if not text or not isinstance(text, str):
        return None
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip().rstrip("`")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    m = re.search(r"\[[\s\S]*\]", cleaned)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    m = re.search(r"\{[\s\S]*\}", cleaned)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    try:
        import ast

        result = ast.literal_eval(cleaned)
        if isinstance(result, (dict, list)):
            return result
    except (ValueError, SyntaxError):
        pass
    for pattern in [r"\{[\s\S]*\}", r"\[[\s\S]*\]"]:
        m = re.search(pattern, cleaned)
        if m:
            try:
                result = ast.literal_eval(m.group(0))
                if isinstance(result, (dict, list)):
                    return result
            except (ValueError, SyntaxError):
                pass
    return None


def _extract_score_from_text(text: str) -> dict | None:
    """Try to extract a score dict from agent prose (e.g. '7/10' or 'overall: 7')."""
    if not text or not isinstance(text, str):
        return None
    overall = None
    m = re.search(r"overall[\"']?\s*[=:]\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
    if m:
        overall = float(m.group(1))
    if overall is None:
        m = re.search(r"(\d+(?:\.\d+)?)\s*/\s*10", text)
        if m:
            overall = float(m.group(1))
    if overall is None:
        m = re.search(r"score[\"']?\s*[=:]\s*(\d+(?:\.\d+)?)", text, re.IGNORECASE)
        if m:
            overall = float(m.group(1))
    if overall is None:
        return None
    o = min(10, max(0, overall))
    rec = "Strong Pass" if o < 4 else "Pass" if o < 5.5 else "Further Diligence" if o < 7 else "Strong Interest" if o < 8.5 else "Conviction Bet"
    return {
        "overall": round(o, 1),
        "breakdown": {"team": o, "market": o, "traction": o, "competition": o, "financials": o},
        "recommendation": rec,
    }


def _build_response_from_shared_state(company_name: str = "") -> dict | None:
    """Build API response from shared_state (reads from current request's context)."""
    from agents import shared_state
    from tools.neo4j_tools import find_competitors

    state = shared_state.analysis_state
    fact_checks_raw = state.get("fact_checks") or state.get("claims")
    score_raw = state.get("score")
    memo = state.get("memo") or ""

    logger.debug("build_response: fact_checks type=%s score type=%s memo len=%d",
                 type(fact_checks_raw).__name__, type(score_raw).__name__, len(str(memo)))

    if isinstance(memo, dict):
        try:
            memo = memo["content"][0]["text"]
        except (KeyError, IndexError, TypeError):
            memo = "Analysis memo unavailable."
    if not isinstance(memo, str):
        memo = str(memo)
    if "save_investment_memo>" in memo or "generate_voice_memo>" in memo:
        memo = re.sub(r"\s*(?:save_investment_memo|generate_voice_memo)\s*>\s*\{[\s\S]*$", "", memo).strip() or memo[:2000]
    audio_filename = state.get("audio_filename") or ""

    fact_checks_str = str(fact_checks_raw) if fact_checks_raw else ""
    claims = _parse_json_from_text(fact_checks_str) if fact_checks_raw else None
    if not isinstance(claims, list) or len(claims) == 0:
        raw_claims_str = str(state.get("claims") or "")
        if raw_claims_str:
            claims = _parse_json_from_text(raw_claims_str)
        if not isinstance(claims, list):
            claims = None
    if isinstance(claims, list):
        VALID_CATEGORIES = {"market_size", "traction", "team", "competition", "financial"}
        CATEGORY_ALIASES = {"market": "market_size", "financials": "financial"}
        VALID_STATUSES = {"verified", "unverified", "partial", "red_flag"}
        for i, c in enumerate(claims):
            if not isinstance(c, dict):
                continue
            if "id" not in c:
                c["id"] = i + 1
            cat = (c.get("category") or "").strip().lower()
            c["category"] = CATEGORY_ALIASES.get(cat, cat) if cat in CATEGORY_ALIASES else (cat if cat in VALID_CATEGORIES else "traction")
            raw_status = (c.get("status") or "").strip().lower().replace(" ", "_").replace("-", "_")
            if raw_status in VALID_STATUSES:
                c["status"] = raw_status
            elif "red" in raw_status or "flag" in raw_status:
                c["status"] = "red_flag"
            elif "verif" in raw_status:
                c["status"] = "verified"
            elif "partial" in raw_status:
                c["status"] = "partial"
            else:
                c["status"] = "unverified"
            if "evidence" not in c:
                c["evidence"] = ""
            if "text" not in c:
                c["text"] = ""

    score_str = str(score_raw) if score_raw else ""
    score = _parse_json_from_text(score_str) if score_raw else None
    if not isinstance(score, dict):
        score = _extract_score_from_text(score_str)
    if not isinstance(score, dict):
        score = {"overall": 0, "breakdown": {}, "recommendation": "Further Diligence"}
    if "breakdown" not in score:
        score["breakdown"] = {}
    for key in ("team", "market", "traction", "competition", "financials"):
        if key not in score["breakdown"]:
            score["breakdown"][key] = 0
    if "overall" not in score or not isinstance(score.get("overall"), (int, float)):
        score["overall"] = round(
            score["breakdown"].get("team", 0) * 0.30 + score["breakdown"].get("market", 0) * 0.25
            + score["breakdown"].get("traction", 0) * 0.20 + score["breakdown"].get("competition", 0) * 0.15
            + score["breakdown"].get("financials", 0) * 0.10, 1
        )
    if "recommendation" not in score or not score["recommendation"]:
        o = score.get("overall", 0)
        score["recommendation"] = "Strong Pass" if o < 4 else "Pass" if o < 5.5 else "Further Diligence" if o < 7 else "Strong Interest" if o < 8.5 else "Conviction Bet"

    try:
        comps = find_competitors(company_name) if company_name else []
        competitors = [
            {
                "name": c.get("name"),
                "total_raised": c.get("total_raised"),
                "stage": c.get("stage"),
                "employee_count": c.get("employee_count"),
            }
            for c in comps
        ]
        logger.info("find_competitors('%s') returned %d results", company_name, len(competitors))
    except Exception as e:
        logger.warning("find_competitors error: %s", e)
        competitors = []

    return {
        "status": "complete",
        "claims": claims if claims else [],
        "score": score,
        "memo": memo,
        "audio_url": f"/api/audio/{audio_filename}" if audio_filename else "",
        "competitors": competitors,
        "company_name": company_name,
    }


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    """Extract text from an uploaded PDF file using PyPDF2."""
    import io
    from PyPDF2 import PdfReader

    try:
        contents = await file.read()
        reader = PdfReader(io.BytesIO(contents))
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text)
        full_text = "\n\n".join(pages)
        return {"text": full_text, "pages": len(reader.pages), "chars": len(full_text)}
    except Exception as e:
        logger.error("PDF extract error: %s", e)
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/api/analyze")
async def analyze_deck(req: AnalyzeRequest):
    """Run the full DealGraph analysis pipeline."""
    return await _analyze_deck_internal(req.deck_text)


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Serve generated audio files."""
    filepath = AUDIO_DIR / filename
    if filepath.exists():
        return FileResponse(str(filepath), media_type="audio/mpeg")
    return JSONResponse(status_code=404, content={"error": f"Audio file '{filename}' not found"})


def _collapse_spaced_text(text: str) -> str:
    """Fix spaced-out text from PDF extraction (e.g., 'A C M E' -> 'ACME')."""
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            cleaned.append("")
            continue
        tokens = stripped.split(" ")
        non_empty = [t for t in tokens if t]
        if len(non_empty) > 3:
            single_char = sum(1 for t in non_empty if len(t) == 1)
            if single_char / len(non_empty) > 0.5:
                result = re.sub(r"  +", "\x00", stripped)
                result = result.replace(" ", "")
                result = result.replace("\x00", " ")
                result = re.sub(r"^[^\w\s]+", "", result).strip()
                stripped = result
        cleaned.append(stripped)
    return "\n".join(cleaned)


def _is_garbage_line(line: str) -> bool:
    """Reject lines that are unlikely to be company names based on structural patterns."""
    if not line or len(line) < 2:
        return True
    special = sum(1 for c in line if not c.isalnum() and c not in " .-&'+")
    if special / len(line) > 0.25:
        return True
    if re.search(r'\d{1,3}[,.]\d{3}', line):
        return True
    if sum(c.isdigit() for c in line) / len(line) > 0.3:
        return True
    return False


def _looks_like_section_header(line: str) -> bool:
    """Detect if an all-caps line is a pitch deck section header rather than a company name.

    Only triggers on lines composed entirely of uppercase letters, spaces, colons,
    ampersands, or hyphens. Uses substring matching against common pitch deck
    section keywords so it generalizes to any deck layout.
    """
    if not re.match(r"^[A-Z\s:&/\-]+$", line) or len(line) < 3:
        return False
    clean = re.sub(r"[^a-z]", "", line.lower())
    header_keywords = [
        "problem", "solution", "market", "traction", "opportunity",
        "landscape", "overview", "competition", "competitive", "financial",
        "revenue", "summary", "appendix", "roadmap", "strategy", "product",
        "technology", "introduction", "conclusion", "disclaimer", "business",
        "investment", "diligence", "team", "funding",
    ]
    return any(kw in clean for kw in header_keywords)


def _extract_company_name(deck_text: str) -> str:
    """Extract company name from pitch deck text. Typically the first meaningful line."""
    cleaned_text = _collapse_spaced_text(deck_text)
    lines = cleaned_text.strip().split("\n")

    # Pass 1: lines with title separators (e.g. "Acme — Series A Pitch Deck")
    for line in lines[:15]:
        line = line.strip()
        if not line or _is_garbage_line(line):
            continue
        for sep in [" - ", " \u2014 ", " \u2013 ", " | "]:
            if sep in line:
                name = line.split(sep)[0].strip()
                if 1 < len(name) < 60 and not _is_garbage_line(name):
                    return name

    # Pass 2: first non-header, non-boilerplate line
    skip_prefixes = [
        "problem", "solution", "market", "team", "traction", "confidential",
        "investor", "overview", "agenda", "table of contents", "disclaimer",
        "page", "slide", "appendix", "copyright", "all rights", "introduction",
        "executive summary", "pitch deck", "presentation", "draft", "private",
        "strictly confidential",
    ]
    for line in lines[:15]:
        line = line.strip()
        if not line or len(line) > 80 or _is_garbage_line(line):
            continue
        if any(line.lower().startswith(p) for p in skip_prefixes):
            continue
        if _looks_like_section_header(line):
            continue
        if len(line) > 1:
            return line
    return "Unknown Company"


def _generate_memo_from_state() -> None:
    """Generate memo and voice briefing from shared_state when the memo_writer agent did not run.
    Writes state['memo'] and state['audio_filename'] so the pipeline always delivers a memo and audio.
    Also ensures state['score'] is valid JSON when the deal_scorer did not call its tool.
    """
    from agents import shared_state
    from tools.minimax_tts import generate_audio

    state = shared_state.analysis_state
    if isinstance(state.get("memo"), str) and len(state["memo"]) > 20:
        return
    score_raw = state.get("score")
    fact_checks_raw = state.get("fact_checks") or state.get("claims")
    score = _parse_json_from_text(str(score_raw)) if score_raw else None
    if not isinstance(score, dict):
        score = _extract_score_from_text(str(score_raw)) if score_raw else None
    if not isinstance(score, dict):
        claims_for_score = _parse_json_from_text(str(fact_checks_raw)) if fact_checks_raw else None
        verified = sum(1 for c in (claims_for_score or []) if isinstance(c, dict) and (c.get("status") or "").lower() == "verified")
        red = sum(1 for c in (claims_for_score or []) if isinstance(c, dict) and "red" in (c.get("status") or "").lower())
        overall = min(10, max(0, 5 + (verified - red) * 0.5))
        rec = "Further Diligence" if overall < 7 else "Strong Interest" if overall < 8.5 else "Conviction Bet"
        score = {
            "overall": round(overall, 1),
            "breakdown": {"team": overall, "market": overall, "traction": overall, "competition": overall, "financials": overall},
            "recommendation": rec,
        }
        state["score"] = json.dumps(score)
    claims = _parse_json_from_text(str(fact_checks_raw)) if fact_checks_raw else None
    def _status(s: str) -> str:
        return ((s or "").strip().lower().replace(" ", "_").replace("-", "_"))
    verified = sum(1 for c in (claims or []) if isinstance(c, dict) and _status(c.get("status")) == "verified")
    red = sum(1 for c in (claims or []) if isinstance(c, dict) and "red" in _status(c.get("status")))
    overall = score.get("overall", 0)
    rec = score.get("recommendation", "Further Diligence")
    b = score.get("breakdown") or {}
    memo_lines = [
        f"# Deal memo (auto-generated)",
        "",
        f"**Overall score:** {overall}/10 · **Recommendation:** {rec}",
        "",
        "## Score breakdown",
        f"- Team: {b.get('team', 0)}/10",
        f"- Market: {b.get('market', 0)}/10",
        f"- Traction: {b.get('traction', 0)}/10",
        f"- Competition: {b.get('competition', 0)}/10",
        f"- Financials: {b.get('financials', 0)}/10",
        "",
        "## Claims",
        f"- {verified} verified, {red} red flags, {len(claims or []) - verified - red} unverified.",
        "",
    ]
    memo_text = "\n".join(memo_lines)
    state["memo"] = memo_text
    voice_script = (
        f"Deal score {overall} out of 10. Recommendation: {rec}. "
        f"{verified} claims verified, {red} red flags. "
        f"Team {b.get('team', 0)}, Market {b.get('market', 0)}, Traction {b.get('traction', 0)}."
    )
    audio_filename = generate_audio(voice_script)
    if audio_filename:
        state["audio_filename"] = audio_filename
    logger.info("Generated deterministic memo and voice (overall=%s)", overall)


async def _analyze_deck_internal(deck_text: str) -> dict:
    """Core analysis pipeline. Runs the blocking agent in a thread pool to avoid
    blocking the FastAPI event loop (health checks, audio, chat stay responsive)."""
    from agents import shared_state
    from agents.orchestrator import create_orchestrator

    # Each request gets isolated state via contextvars
    shared_state.reset_state()

    # Clean up old audio files opportunistically
    _cleanup_old_audio()

    company_name = _extract_company_name(deck_text)
    logger.info("Pipeline start: company='%s' text_len=%d", company_name, len(deck_text))

    pipeline_error = None
    try:
        agent = create_orchestrator()
        prompt = f"Analyze this pitch deck:\n\n{deck_text}"
        await asyncio.to_thread(agent, prompt)
    except Exception as e:
        import traceback
        logger.error("Pipeline error (will try partial results): %s", e)
        traceback.print_exc()
        pipeline_error = str(e)

    _generate_memo_from_state()
    result = _build_response_from_shared_state(company_name)
    if result:
        claims_ok = isinstance(result.get("claims"), list) and len(result["claims"]) > 0
        memo_ok = isinstance(result.get("memo"), str) and len(result["memo"]) > 10
        score_ok = isinstance(result.get("score"), dict) and result["score"].get("overall", 0) > 0

        logger.info("Pipeline validation: claims=%s memo=%s score=%s error=%s",
                     claims_ok, memo_ok, score_ok, pipeline_error is not None)

        if claims_ok or memo_ok or score_ok:
            if pipeline_error and not memo_ok:
                result["memo"] = f"Pipeline partially completed (memo generation failed). Score and claims are from completed steps.\n\nError: {pipeline_error[:200]}"
            result["status"] = "partial" if pipeline_error else "complete"
            logger.info("Returning %s results", result["status"])
            return result

    return {
        "status": "error",
        "claims": [],
        "score": {"overall": 0, "breakdown": {"team": 0, "market": 0, "traction": 0, "competition": 0, "financials": 0}, "recommendation": "Analysis Failed"},
        "memo": f"Analysis pipeline failed for '{company_name}'. Error: {pipeline_error or 'Unknown'}",
        "audio_url": "",
        "competitors": [],
        "company_name": company_name,
    }


# ── CopilotKit AG-UI Protocol via ag_ui_strands ──

@strands_tool
def query_competitors(company_name: str) -> str:
    """Find competitors for a company in the knowledge graph. Returns competitor names, funding amounts, and market data."""
    import json
    from tools.neo4j_tools import find_competitors
    competitors = find_competitors(company_name)
    if not competitors:
        return json.dumps({
            "competitors": [],
            "message": f"No competitors found in the knowledge graph for '{company_name}'. The company may not be in the graph or may not share a market with other tracked companies.",
        })
    return json.dumps(competitors)


@strands_tool
def verify_founder_background(founder_name: str) -> str:
    """Verify a founder's background and experience in the knowledge graph."""
    from tools.neo4j_tools import verify_founder
    return str(verify_founder(founder_name))


@strands_tool
def check_market(market_name: str) -> str:
    """Check market size and growth data in the knowledge graph."""
    from tools.neo4j_tools import check_market_data
    return str(check_market_data(market_name))


# --- HACKATHON: AWS Bedrock CopilotKit agent ---
# _bedrock_model = StrandsBedrockModel(
#     model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
#     region_name=os.getenv("AWS_DEFAULT_REGION", "us-west-2"),
# )

_strands_agent = StrandsNativeAgent(
    model=get_model(),
    system_prompt="""You are DealGraph, an AI due diligence copilot that answers questions about the SPECIFIC company from the uploaded pitch deck.

CRITICAL: Your analysis context contains the results from the pitch deck analysis pipeline. ALL your answers must be about THIS company — the one from the uploaded PDF. Never talk about other companies unless comparing them as competitors.

RULES:
1. ALWAYS use your tools — the UI renders visual cards for each tool call.
2. Keep text to 1-2 sentences MAX. Visual cards from tools are the primary output.
3. When asked about founders: find the founder names FROM THE ANALYSIS CONTEXT, then call verify_founder_background for each.
4. When asked about competitors: use the company_name FROM THE ANALYSIS CONTEXT and call query_competitors with THAT name.
5. When asked about market: identify the market FROM THE ANALYSIS CONTEXT and call check_market.
6. NEVER query for companies/founders/markets that are NOT related to the analyzed pitch deck.
7. If no analysis context is available, tell the user to upload a pitch deck first.
8. Do NOT repeat data the tool cards will show. Do NOT use emojis.

Example: User asks "tell me about the founders" after uploading a Brex pitch deck:
- Find founder names in the analysis context (e.g. "Henrique Dubugras", "Pedro Franceschi")
- Call verify_founder_background("Henrique Dubugras")
- Call verify_founder_background("Pedro Franceschi")
- Text: "Here are the verification results for both Brex founders." """,
    tools=[query_competitors, verify_founder_background, check_market],
)

def _inject_copilotkit_context(input_data: RunAgentInput, user_message: str) -> str:
    """Prepend CopilotKit readable context (from useCopilotReadable) to the user message."""
    context_parts = []
    if hasattr(input_data, "context") and input_data.context:
        for ctx in input_data.context:
            desc = getattr(ctx, "description", "") or ""
            val = getattr(ctx, "value", "") or ""
            if val:
                context_parts.append(f"[{desc}]: {val}" if desc else val)

    if context_parts:
        context_block = "\n\n".join(context_parts)
        logger.debug("CopilotKit context injected: %d chars", len(context_block))
        return f"--- ANALYSIS CONTEXT FROM DASHBOARD ---\n{context_block}\n--- END CONTEXT ---\n\nUser question: {user_message}"

    return user_message


_ag_ui_agent = StrandsAgent(
    _strands_agent,
    name="default",
    description=(
        "DealGraph AI Due Diligence Agent - analyzes pitch decks, "
        "verifies claims against knowledge graph, scores deals, "
        "and generates investment memos"
    ),
    config=StrandsAgentConfig(
        state_context_builder=_inject_copilotkit_context,
    ),
)

_AGENT_INFO = {
    "agents": {
        "default": {
            "name": "default",
            "description": _ag_ui_agent.description,
        }
    },
}


@app.post("/copilotkit")
@app.post("/copilotkit/")
@app.post("/copilotkit/{path:path}")
async def copilotkit_handler(request: Request, path: str = ""):
    """CopilotKit AG-UI endpoint: handles info discovery + agent runs via ag_ui_strands."""
    body = await request.body()
    body_str = body.decode("utf-8", errors="replace")

    try:
        data = json.loads(body_str) if body_str else {}
    except json.JSONDecodeError:
        data = {}

    method = data.get("method", "")
    agent_data = data.get("body", data)

    has_messages = isinstance(agent_data, dict) and "messages" in agent_data
    has_thread = isinstance(agent_data, dict) and "thread_id" in agent_data
    has_run = isinstance(agent_data, dict) and "run_id" in agent_data
    is_agent_run = has_messages or has_thread or has_run

    logger.debug("CopilotKit: method='%s' is_agent_run=%s", method, is_agent_run)

    if is_agent_run:
        try:
            input_data = RunAgentInput(**agent_data)
        except Exception as e:
            logger.error("CopilotKit RunAgentInput validation: %s", e)
            return JSONResponse({"error": str(e)}, status_code=500)

        accept_header = request.headers.get("accept")
        encoder = EventEncoder(accept=accept_header)

        async def event_generator():
            try:
                async for event in _ag_ui_agent.run(input_data):
                    try:
                        yield encoder.encode(event)
                    except Exception as e:
                        logger.error("CopilotKit encode error: %s", e)
                        from ag_ui_protocol import RunErrorEvent, EventType

                        yield encoder.encode(
                            RunErrorEvent(
                                type=EventType.RUN_ERROR,
                                message=f"Encoding error: {str(e)}",
                                code="ENCODING_ERROR",
                            )
                        )
                        break
            except Exception as e:
                logger.error("CopilotKit agent run error: %s", e)

        return StreamingResponse(
            event_generator(),
            media_type=encoder.get_content_type(),
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    return JSONResponse(_AGENT_INFO)


logger.info("DealGraph API ready — CopilotKit endpoint at /copilotkit")


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
