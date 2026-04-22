"""DealGraph API — FastAPI backend for the AI due-diligence pipeline.

Endpoints:
  POST /api/analyze     — run the full claim-routed pipeline on pitch deck text
  POST /api/extract-pdf — extract text from an uploaded PDF
  GET  /api/audio/{fn}  — serve generated voice memos
  GET  /api/health      — health check
  POST /copilotkit      — CopilotKit AG-UI streaming endpoint
"""

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

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel, field_validator
from dotenv import load_dotenv

load_dotenv()

# Langfuse: patch openai before strands/model_config so LLM calls are traced (optional)
import telemetry
telemetry._patch_langfuse_openai()

from strands import Agent as StrandsNativeAgent, tool as strands_tool
from ag_ui_strands import StrandsAgent, StrandsAgentConfig
from ag_ui_strands.endpoint import EventEncoder, RunAgentInput


def _patch_ag_ui_strands_agent_state() -> None:
    """ag_ui_strands expects agent.state._state; strands uses JSONSerializableDict (snapshot via .get())."""
    import ag_ui_strands.agent as _agui_agent

    def _fixed_init(self, agent, name: str, description: str = "", config=None):
        self._model = agent.model
        self._system_prompt = agent.system_prompt
        self._tools = (
            list(agent.tool_registry.registry.values())
            if hasattr(agent, "tool_registry")
            else []
        )
        self._agent_kwargs = {
            "record_direct_tool_call": agent.record_direct_tool_call
            if hasattr(agent, "record_direct_tool_call")
            else True,
        }
        if hasattr(agent, "trace_attributes") and agent.trace_attributes:
            self._agent_kwargs["trace_attributes"] = agent.trace_attributes
        if hasattr(agent, "agent_id") and agent.agent_id:
            self._agent_kwargs["agent_id"] = agent.agent_id
        if hasattr(agent, "state") and agent.state is not None:
            st = agent.state
            if hasattr(st, "_state"):
                self._agent_kwargs["state"] = st._state
            elif callable(getattr(st, "get", None)):
                self._agent_kwargs["state"] = st.get()
            else:
                self._agent_kwargs["state"] = st

        self.name = name
        self.description = description
        self.config = config or StrandsAgentConfig()
        self._agents_by_thread = {}
        self._proxy_tool_names_by_thread = {}

    _agui_agent.StrandsAgent.__init__ = _fixed_init


_patch_ag_ui_strands_agent_state()

from model_config import get_model

logger = logging.getLogger("dealgraph")
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
)

AUDIO_DIR = Path(__file__).parent / "audio"
AUDIO_DIR.mkdir(exist_ok=True)

FALLBACK_AUDIO_FILENAME = "fallback_memo.mp3"


def _ensure_fallback_audio() -> str:
    """Ensure fallback_memo.mp3 exists (e.g. when TTS fails). Returns filename or \"\"."""
    fallback_path = AUDIO_DIR / FALLBACK_AUDIO_FILENAME
    if fallback_path.exists():
        return FALLBACK_AUDIO_FILENAME
    try:
        from tools.minimax_tts import generate_audio
        short = "Deal memo summary not available."
        fn = generate_audio(short)
        if fn and (AUDIO_DIR / fn).exists():
            (AUDIO_DIR / fn).rename(fallback_path)
            return FALLBACK_AUDIO_FILENAME
    except Exception as e:
        logger.warning("Could not create fallback audio: %s", e)
    return ""

_raw = os.getenv("CORS_ORIGINS", "*").strip()
CORS_ORIGINS = [o.strip() for o in _raw.split(",") if o.strip()]
# When using "*", credentials must be False (CORS spec). When listing explicit origins, credentials can be True.
CORS_CREDENTIALS = "*" not in CORS_ORIGINS and len(CORS_ORIGINS) > 0
ALLOW_ANY_ORIGIN = not CORS_ORIGINS or "*" in CORS_ORIGINS


class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    """Inject CORS headers into every response so they are always present (fixes preflight/edge cases)."""

    async def dispatch(self, request: Request, call_next):
        origin = request.headers.get("origin", "").strip()
        if request.method == "OPTIONS":
            # Preflight: return 200 with CORS headers immediately
            allow_origin = "*" if ALLOW_ANY_ORIGIN else (origin if origin in CORS_ORIGINS else None)
            if allow_origin is None:
                return Response(status_code=403)
            headers = {
                "Access-Control-Allow-Origin": allow_origin,
                "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            }
            if CORS_CREDENTIALS:
                headers["Access-Control-Allow-Credentials"] = "true"
            return Response(status_code=200, headers=headers)
        response = await call_next(request)
        allow_origin = "*" if ALLOW_ANY_ORIGIN else (origin if origin in CORS_ORIGINS else None)
        if allow_origin:
            response.headers["Access-Control-Allow-Origin"] = allow_origin
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
            if CORS_CREDENTIALS:
                response.headers["Access-Control-Allow-Credentials"] = "true"
        return response


app = FastAPI(title="DealGraph API", redirect_slashes=False)
app.add_middleware(EnsureCORSHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=CORS_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)
telemetry.setup_telemetry(app)

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


def _score_from_evidence(claims: list[dict]) -> dict:
    """Build a score dict from normalized claims when the DealScorer did not run."""
    def _is_red(s: str) -> bool:
        s = (s or "").strip().lower()
        return s == "red_flag" or "red" in s or s in ("contradicted", "flagged")
    verified = sum(1 for c in claims if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "verified")
    red = sum(1 for c in claims if isinstance(c, dict) and _is_red(c.get("status") or ""))
    n = len([c for c in claims if isinstance(c, dict)])
    if n == 0:
        return {"overall": 0, "breakdown": {}, "recommendation": "Further Diligence"}
    # Base 5, +1.2 per verified, -1.5 per red flag, capped 0-10
    overall = max(0, min(10, round(5 + verified * 1.2 - red * 1.5, 1)))
    rec = "Strong Pass" if overall < 4 else "Pass" if overall < 5.5 else "Further Diligence" if overall < 7 else "Strong Interest" if overall < 8.5 else "Conviction Bet"
    # Spread by category: average score for claims in each category
    cat_scores = {"team": [], "market": [], "traction": [], "competition": [], "financials": []}
    for c in claims:
        if not isinstance(c, dict):
            continue
        cat = (c.get("category") or "traction").strip().lower()
        st = (c.get("status") or "").strip().lower()
        pts = 8 if st == "verified" else (3 if _is_red(st) else 5)
        if cat in ("market_size", "market"):
            cat_scores["market"].append(pts)
        elif cat == "team":
            cat_scores["team"].append(pts)
        elif cat == "traction":
            cat_scores["traction"].append(pts)
        elif cat == "competition":
            cat_scores["competition"].append(pts)
        elif cat in ("financial", "financials"):
            cat_scores["financials"].append(pts)
    breakdown = {k: round(sum(v) / len(v), 1) if v else overall for k, v in cat_scores.items()}
    return {"overall": overall, "breakdown": breakdown, "recommendation": rec}


def _extract_competitors_from_web(web_results: list, company_name: str) -> list[dict]:
    """Best-effort extraction of competitor names from raw Tavily search snippets."""
    if not web_results:
        return []
    competitors = []
    seen = set()
    target_lower = company_name.lower() if company_name else ""
    for batch in web_results:
        if not isinstance(batch, list):
            continue
        for item in batch:
            if not isinstance(item, dict):
                continue
            title = item.get("title", "")
            # Titles like "Top 10 Brex Competitors" sometimes contain company names
            snippet = item.get("snippet", "")
            for text in [title, snippet]:
                # Look for capitalized multi-word names that aren't the target company
                import re as _re
                for match in _re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b", text):
                    name = match.strip()
                    if (
                        2 < len(name) < 40
                        and name.lower() != target_lower
                        and name.lower() not in seen
                        and name.lower() not in ("the", "and", "for", "with", "from")
                    ):
                        seen.add(name.lower())
                        competitors.append({
                            "name": name,
                            "total_raised": 0,
                            "stage": "Unknown",
                        })
            if len(competitors) >= 8:
                break
        if len(competitors) >= 8:
            break
    return competitors[:8]


def _dedupe_competitors_by_name(competitors: list[dict]) -> list[dict]:
    """Keep one entry per company name (case-insensitive); prefer the one with highest total_raised."""
    by_name: dict[str, dict] = {}
    for c in competitors:
        if not isinstance(c, dict):
            continue
        name = (c.get("name") or "").strip()
        if not name:
            continue
        key = name.lower()
        existing = by_name.get(key)
        if existing is None or (c.get("total_raised") or 0) > (existing.get("total_raised") or 0):
            by_name[key] = {**c, "name": name}
    return list(by_name.values())


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
    if not audio_filename and (state.get("memo") or "").strip():
        audio_filename = _ensure_fallback_audio() or ""

    # Prefer normalized evidence list from pipeline; fall back to fact_checks JSON string, then raw claims
    evidence_list = state.get("evidence")
    if isinstance(evidence_list, list) and len(evidence_list) > 0:
        claims = [dict(e) for e in evidence_list]
    else:
        fact_checks_str = str(fact_checks_raw) if fact_checks_raw else ""
        claims = _parse_json_from_text(fact_checks_str) if fact_checks_raw else None
        if not isinstance(claims, list) or len(claims) == 0:
            raw_claims_str = str(state.get("claims") or "")
            if raw_claims_str:
                claims = _parse_json_from_text(raw_claims_str)
            if not isinstance(claims, list):
                claims = None
    if isinstance(claims, list):
        # Normalize evidence-style items (claim_id, claim_text, supporting_data) to frontend shape (id, text, evidence)
        for c in claims:
            if not isinstance(c, dict):
                continue
            if "text" not in c and c.get("claim_text"):
                c["text"] = c["claim_text"]
            if "evidence" not in c and c.get("supporting_data") is not None:
                c["evidence"] = c["supporting_data"]
            if "id" not in c and c.get("claim_id") is not None:
                c["id"] = c["claim_id"]

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
            elif "red" in raw_status or "flag" in raw_status or "contradict" in raw_status:
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
    if not isinstance(score, dict) and isinstance(claims, list) and len(claims) > 0:
        score = _score_from_evidence(claims)
    if not isinstance(score, dict):
        score = {"overall": 0, "breakdown": {}, "recommendation": "Further Diligence"}
    # If score looks like the constant fallback (all 5s) but we have claims, derive from evidence
    if isinstance(claims, list) and len(claims) > 0 and isinstance(score, dict):
        b = score.get("breakdown") or {}
        if score.get("overall") == 5 and all(b.get(k) == 5 for k in ("team", "market", "traction", "competition", "financials")):
            score = _score_from_evidence(claims)
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

    # Fall back to web search results for competitor display when graph is empty
    if not competitors:
        web_results = state.get("web_search_results") or []
        competitors = _extract_competitors_from_web(web_results, company_name)
        if competitors:
            logger.info("Populated %d competitors from web search results", len(competitors))
    # If still empty and we have a company name, run a dedicated Tavily "X competitors" search
    if not competitors and company_name:
        try:
            from tools.web_resolver import search_competitors
            raw = search_competitors(company_name)
            batch = [{"title": r.get("title", ""), "snippet": (r.get("content") or r.get("snippet", ""))[:500]} for r in raw]
            competitors = _extract_competitors_from_web([batch], company_name) if batch else []
            if competitors:
                logger.info("Populated %d competitors from Tavily competitor search", len(competitors))
        except Exception as e:
            logger.warning("Tavily competitor search failed: %s", e)

    # One node per company: Memgraph can return the same company for multiple markets
    competitors = _dedupe_competitors_by_name(competitors)

    # If memo is the auto-generated fallback but score/claims don't match, rebuild memo so voice memo matches the UI
    if claims and memo and "Deal memo (auto-generated)" in memo:
        v_count = sum(1 for c in claims if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "verified")
        r_count = sum(1 for c in claims if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "red_flag")
        u_count = len(claims) - v_count - r_count
        b = score.get("breakdown") or {}
        expected_line = f"- {v_count} verified, {r_count} red flags, {u_count} unverified."
        if expected_line not in memo or str(score.get("overall", 0)) not in memo:
            memo = (
                f"# Deal memo (auto-generated)\n\n"
                f"**Overall score:** {score.get('overall', 0)}/10 · **Recommendation:** {score.get('recommendation', 'Further Diligence')}\n\n"
                f"## Score breakdown\n"
                f"- Team: {b.get('team', 0)}/10\n- Market: {b.get('market', 0)}/10\n- Traction: {b.get('traction', 0)}/10\n"
                f"- Competition: {b.get('competition', 0)}/10\n- Financials: {b.get('financials', 0)}/10\n\n"
                f"## Claims\n- {v_count} verified, {r_count} red flags, {u_count} unverified.\n"
            )

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
    try:
        from tools.neo4j_tools import get_memgraph_status
        memgraph = get_memgraph_status()
    except Exception:
        memgraph = "error"
    return {"status": "ok", "memgraph": memgraph}


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


def _build_voice_briefing_script(
    score: dict,
    claims: list[dict],
    recommendation: str,
    overall: float,
    verified_count: int,
    red_count: int,
) -> str:
    """Build a 60-90 second spoken briefing: verdict, key strengths, red flags, recommendation.
    Used when memo_writer did not produce a voice script; keeps tone conversational for TTS.
    """
    b = score.get("breakdown") or {}
    parts = []

    # Opening verdict
    parts.append(
        f"Deal score {overall} out of 10. Verdict: {recommendation}."
    )

    # Key strengths from verified claims (1-2 short phrases)
    verified_claims = [
        (c.get("text") or c.get("claim_text") or "").strip()
        for c in claims
        if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "verified"
    ]
    if verified_claims:
        strength = verified_claims[0][:120]
        if len(verified_claims[0]) > 120:
            strength = strength.rstrip() + "..."
        parts.append(f" On the plus side, we verified: {strength}")
    elif verified_count > 0:
        parts.append(f" {verified_count} claims were verified with supporting data.")

    # Red flags
    if red_count > 0:
        red_claims = [
            (c.get("text") or c.get("claim_text") or "").strip()[:100]
            for c in claims
            if isinstance(c, dict)
            and (
                (c.get("status") or "").strip().lower() in ("red_flag", "contradicted", "flagged")
                or "red" in (c.get("status") or "").lower()
            )
        ]
        if red_claims:
            parts.append(f" Red flags: {red_claims[0]}")
        else:
            parts.append(f" We have {red_count} red flags to follow up on.")
    else:
        parts.append(" No red flags identified.")

    # Score snapshot and bottom line
    parts.append(
        f" Score breakdown: Team {b.get('team', 5)}, Market {b.get('market', 5)}, Traction {b.get('traction', 5)}, "
        f"Competition {b.get('competition', 5)}, Financials {b.get('financials', 5)}."
    )
    parts.append(f" Bottom line: {recommendation}.")

    script = " ".join(parts)
    # Target ~150-200 words for 60-90 sec; trim if way over
    words = script.split()
    if len(words) > 220:
        script = " ".join(words[:220]) + "."
    return script


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
        if isinstance(claims_for_score, list) and len(claims_for_score) > 0:
            score = _score_from_evidence(claims_for_score)
            state["score"] = json.dumps(score)
        else:
            verified = sum(1 for c in (claims_for_score or []) if isinstance(c, dict) and (c.get("status") or "").lower() == "verified")
            red = sum(1 for c in (claims_for_score or []) if isinstance(c, dict) and ("red" in (c.get("status") or "").lower() or (c.get("status") or "").lower() in ("contradicted", "flagged")))
            overall = min(10, max(0, 5 + (verified - red) * 0.5))
            rec = "Further Diligence" if overall < 7 else "Strong Interest" if overall < 8.5 else "Conviction Bet"
            score = {
                "overall": round(overall, 1),
                "breakdown": {"team": overall, "market": overall, "traction": overall, "competition": overall, "financials": overall},
                "recommendation": rec,
            }
            state["score"] = json.dumps(score)
    claims = _parse_json_from_text(str(fact_checks_raw)) if fact_checks_raw else None
    # Prefer evidence list so we get normalized status (red_flag vs contradicted/flagged)
    evidence_list = state.get("evidence")
    if isinstance(evidence_list, list) and len(evidence_list) > 0:
        claims = [dict(e) for e in evidence_list]
    elif not isinstance(claims, list) or len(claims) == 0:
        claims = []
    def _is_red(s: str) -> bool:
        s = (s or "").strip().lower().replace(" ", "_").replace("-", "_")
        return s == "red_flag" or "red" in s or s in ("contradicted", "flagged")
    verified = sum(1 for c in (claims or []) if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "verified")
    red = sum(1 for c in (claims or []) if isinstance(c, dict) and _is_red(c.get("status") or ""))
    overall = score.get("overall", 0)
    rec = score.get("recommendation", "Further Diligence")
    b = score.get("breakdown") or {}
    memo_lines = [
        f"# Deal memo (auto-generated)",
        "",
        f"**Verdict:** {rec} — {overall}/10.",
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
    voice_script = _build_voice_briefing_script(score, claims or [], rec, overall, verified, red)
    audio_filename = generate_audio(voice_script)
    if audio_filename:
        state["audio_filename"] = audio_filename
    else:
        fallback = _ensure_fallback_audio()
        if fallback:
            state["audio_filename"] = fallback
    logger.info("Generated deterministic memo and voice (overall=%s)", overall)


def _ensure_voice_briefing_from_state() -> None:
    """Always set voice memo to the 60-90 sec briefing (verdict, strengths, red flags, recommendation).
    Overwrites any audio the agent may have set from the full written memo, so TTS never reads the long markdown.
    """
    from agents import shared_state
    from tools.minimax_tts import generate_audio

    state = shared_state.analysis_state
    score_raw = state.get("score")
    score = _parse_json_from_text(str(score_raw)) if score_raw else None
    if not isinstance(score, dict):
        score = _extract_score_from_text(str(score_raw)) if score_raw else None
    if not isinstance(score, dict):
        fact_checks_raw = state.get("fact_checks") or state.get("claims")
        claims_for_score = _parse_json_from_text(str(fact_checks_raw)) if fact_checks_raw else None
        if isinstance(claims_for_score, list) and len(claims_for_score) > 0:
            score = _score_from_evidence(claims_for_score)
        else:
            return
    evidence_list = state.get("evidence")
    if isinstance(evidence_list, list) and len(evidence_list) > 0:
        claims = [dict(e) for e in evidence_list]
    else:
        fact_checks_raw = state.get("fact_checks") or state.get("claims")
        claims = _parse_json_from_text(str(fact_checks_raw)) if fact_checks_raw else None
        if not isinstance(claims, list):
            claims = []

    def _is_red(s: str) -> bool:
        s = (s or "").strip().lower().replace(" ", "_").replace("-", "_")
        return s == "red_flag" or "red" in s or s in ("contradicted", "flagged")
    verified = sum(1 for c in (claims or []) if isinstance(c, dict) and (c.get("status") or "").strip().lower() == "verified")
    red = sum(1 for c in (claims or []) if isinstance(c, dict) and _is_red(c.get("status") or ""))
    overall = score.get("overall", 0)
    rec = score.get("recommendation", "Further Diligence")

    voice_script = _build_voice_briefing_script(score, claims or [], rec, overall, verified, red)
    audio_filename = generate_audio(voice_script)
    if audio_filename:
        state["audio_filename"] = audio_filename
        logger.info("Voice memo set to 60-90s briefing (overall=%s)", overall)
    else:
        fallback = _ensure_fallback_audio()
        if fallback:
            state["audio_filename"] = fallback


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
    # Always overwrite voice with 60-90s briefing (verdict, strengths, red flags, recommendation).
    # Stops the agent from ever TTS-ing the full written memo.
    _ensure_voice_briefing_from_state()
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

    fallback_fn = _ensure_fallback_audio()
    return {
        "status": "error",
        "claims": [],
        "score": {"overall": 0, "breakdown": {"team": 0, "market": 0, "traction": 0, "competition": 0, "financials": 0}, "recommendation": "Analysis Failed"},
        "memo": f"Analysis pipeline failed for '{company_name}'. Error: {pipeline_error or 'Unknown'}",
        "audio_url": f"/api/audio/{fallback_fn}" if fallback_fn else "",
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
