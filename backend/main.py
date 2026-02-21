import os
import sys

# Fix Windows console encoding — agent output may contain emojis/unicode
# that the default charmap codec can't handle
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Disable ddtrace auto-patching of our local "agents" package BEFORE any imports.
# ddtrace mistakes it for the OpenAI Agents SDK and tries to import agents.tracing,
# which crashes the process with ModuleNotFoundError.
os.environ["DD_TRACE_OPENAI_AGENTS_ENABLED"] = "false"
try:
    import ddtrace
    ddtrace.config._disabled_integrations.add("openai_agents")
except Exception:
    pass

import json
import re
import types
from pathlib import Path

from fastapi import FastAPI, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

import uuid
import logging

load_dotenv()

# ag_ui_strands: official Strands <-> CopilotKit bridge via AG-UI protocol
from strands import Agent as StrandsNativeAgent, tool as strands_tool
from strands.models.bedrock import BedrockModel as StrandsBedrockModel
from ag_ui_strands import StrandsAgent, StrandsAgentConfig
from ag_ui_strands.endpoint import EventEncoder, RunAgentInput

# Suppress noisy ddtrace "failed to send traces" spam
logging.getLogger("ddtrace").setLevel(logging.CRITICAL)

# Datadog LLMObs setup
try:
    from ddtrace.llmobs import LLMObs
    LLMObs.enable(
        ml_app="dealgraph",
        api_key=os.getenv("DD_API_KEY"),
        site=os.getenv("DD_SITE", "datadoghq.com"),
        agentless_enabled=True
    )
    print("[DealGraph] Datadog LLMObs enabled")
except Exception as e:
    print(f"[DealGraph] Datadog LLMObs skipped: {e}")

def _log(msg: str):
    """Print that won't crash on Windows with emoji/unicode in agent output."""
    try:
        print(msg)
    except (UnicodeEncodeError, UnicodeDecodeError):
        print(msg.encode("ascii", errors="replace").decode("ascii"))


app = FastAPI(title="DealGraph API", redirect_slashes=False)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Paths
AUDIO_DIR = Path(__file__).parent / "audio"
FALLBACK_RESPONSE_PATH = Path(__file__).parent / "fallback_response.json"


class AnalyzeRequest(BaseModel):
    deck_text: str


def _load_fallback_response() -> dict:
    if FALLBACK_RESPONSE_PATH.exists():
        with open(FALLBACK_RESPONSE_PATH, encoding="utf-8") as f:
            return json.load(f)
    return {
        "status": "complete",
        "claims": [],
        "score": {"overall": 0, "breakdown": {}, "recommendation": "Further Diligence"},
        "memo": "Analysis unavailable.",
        "audio_url": "/api/audio/fallback_memo.mp3",
        "competitors": []
    }


def _parse_json_from_text(text: str):
    """Try to extract and parse JSON from agent output (may be wrapped in markdown or prose)."""
    if not text or not isinstance(text, str):
        return None
    # Strip markdown code fences if present
    cleaned = re.sub(r'```(?:json)?\s*', '', text).strip().rstrip('`')
    # Try direct parse
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    # Try to find JSON array
    m = re.search(r'\[[\s\S]*\]', cleaned)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    # Try to find JSON object
    m = re.search(r'\{[\s\S]*\}', cleaned)
    if m:
        try:
            return json.loads(m.group(0))
        except json.JSONDecodeError:
            pass
    # Last resort: Python repr uses single quotes — try converting
    try:
        import ast
        result = ast.literal_eval(cleaned)
        if isinstance(result, (dict, list)):
            return result
    except (ValueError, SyntaxError):
        pass
    # Try ast.literal_eval on extracted object/array
    for pattern in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
        m = re.search(pattern, cleaned)
        if m:
            try:
                result = ast.literal_eval(m.group(0))
                if isinstance(result, (dict, list)):
                    return result
            except (ValueError, SyntaxError):
                pass
    return None


def _build_response_from_shared_state(company_name: str = "") -> dict | None:
    """Build API response from shared_state. Returns None if insufficient data."""
    from agents import shared_state
    from tools.neo4j_tools import find_competitors

    state = shared_state.analysis_state
    fact_checks_raw = state.get("fact_checks") or state.get("claims")
    score_raw = state.get("score")
    memo = state.get("memo") or ""

    _log(f"[DEBUG build_response] fact_checks_raw type={type(fact_checks_raw).__name__} len={len(str(fact_checks_raw))}")
    _log(f"[DEBUG build_response] score_raw type={type(score_raw).__name__} preview={str(score_raw)[:300]}")
    _log(f"[DEBUG build_response] memo type={type(memo).__name__} len={len(str(memo))}")

    # Normalize memo: sometimes the agent leaves a message object instead of a string
    if isinstance(memo, dict):
        try:
            memo = memo["content"][0]["text"]
        except (KeyError, IndexError, TypeError):
            memo = "Analysis memo unavailable."
    if not isinstance(memo, str):
        memo = str(memo)
    audio_filename = state.get("audio_filename") or "fallback_memo.mp3"

    fact_checks_str = str(fact_checks_raw) if fact_checks_raw else ""
    _log(f"[DEBUG build_response] parsing claims from: {fact_checks_str[:300]}")
    claims = _parse_json_from_text(fact_checks_str) if fact_checks_raw else None
    _log(f"[DEBUG build_response] parsed claims: type={type(claims).__name__} value={str(claims)[:200] if claims else 'None'}")
    if not isinstance(claims, list):
        claims = None
    else:
        # Normalize claim fields to match frontend types exactly
        VALID_CATEGORIES = {"market_size", "traction", "team", "competition", "financial"}
        VALID_STATUSES = {"verified", "unverified", "partial", "red_flag"}
        for i, c in enumerate(claims):
            if not isinstance(c, dict):
                continue
            if "id" not in c:
                c["id"] = i + 1
            if c.get("category") not in VALID_CATEGORIES:
                c["category"] = "traction"
            if c.get("status") not in VALID_STATUSES:
                c["status"] = "unverified"
            if "evidence" not in c:
                c["evidence"] = ""
            if "text" not in c:
                c["text"] = ""

    score_str = str(score_raw) if score_raw else ""
    _log(f"[DEBUG build_response] parsing score from: {score_str[:300]}")
    score = _parse_json_from_text(score_str) if score_raw else None
    _log(f"[DEBUG build_response] parsed score: {score}")
    if not isinstance(score, dict):
        score = {"overall": 0, "breakdown": {}, "recommendation": "Further Diligence"}
    if "breakdown" not in score:
        score["breakdown"] = {}
    # Ensure all 5 breakdown keys exist (frontend requires exactly these)
    for key in ("team", "market", "traction", "competition", "financials"):
        if key not in score["breakdown"]:
            score["breakdown"][key] = 0
    if "recommendation" not in score:
        score["recommendation"] = "Further Diligence"

    try:
        comps = find_competitors(company_name) if company_name else []
        competitors = [
            {"name": c.get("name"), "total_raised": c.get("total_raised"), "stage": c.get("stage"), "employee_count": c.get("employee_count")}
            for c in comps
        ]
        _log(f"[DEBUG build_response] find_competitors('{company_name}') returned {len(competitors)} results")
    except Exception as e:
        _log(f"[DEBUG build_response] find_competitors error: {e}")
        competitors = []

    # Fallback: if no competitors from Neo4j, use fallback data so graph is never empty
    if not competitors:
        _log("[DEBUG build_response] No competitors from Neo4j — using fallback competitors")
        fallback = _load_fallback_response()
        competitors = fallback.get("competitors", [])

    return {
        "status": "complete",
        "claims": claims if claims else [],
        "score": score,
        "memo": memo,
        "audio_url": f"/api/audio/{audio_filename}",
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
        _log(f"[PDF Extract] Error: {e}")
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
    fallback = AUDIO_DIR / "fallback_memo.mp3"
    if fallback.exists():
        return FileResponse(str(fallback), media_type="audio/mpeg")
    return {"error": "Audio not found"}


def _collapse_spaced_text(text: str) -> str:
    """Fix spaced-out text from PDF extraction (e.g., 'A C M E' → 'ACME')."""
    lines = text.split("\n")
    cleaned = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            cleaned.append("")
            continue
        # Check if line has spaced-out characters (common in decorative PDF fonts)
        tokens = stripped.split(" ")
        non_empty = [t for t in tokens if t]
        if len(non_empty) > 3:
            single_char = sum(1 for t in non_empty if len(t) == 1)
            if single_char / len(non_empty) > 0.5:
                # Collapse: multi-spaces → word boundary, single spaces → join
                result = re.sub(r'  +', '\x00', stripped)
                result = result.replace(' ', '')
                result = result.replace('\x00', ' ')
                # Remove non-alphanumeric prefix artifacts (like ⚔ emoji)
                result = re.sub(r'^[^\w\s]+', '', result).strip()
                stripped = result
        cleaned.append(stripped)
    return "\n".join(cleaned)


def _extract_company_name(deck_text: str) -> str:
    """Try to extract the company name from the pitch deck text."""
    # Clean spaced-out PDF artifacts first
    cleaned_text = _collapse_spaced_text(deck_text)
    lines = cleaned_text.strip().split("\n")

    # Strategy 1: Look for "CompanyName - Pitch Deck" or "CompanyName — Series A" patterns
    for line in lines[:15]:
        line = line.strip()
        if not line:
            continue
        for sep in [" - ", " — ", " – ", " | "]:
            if sep in line:
                name = line.split(sep)[0].strip()
                if 1 < len(name) < 60:
                    return name

    # Strategy 2: First short non-generic line
    skip_words = ["problem", "solution", "market", "team", "traction", "confidential",
                   "investor", "overview", "agenda", "table of contents", "disclaimer"]
    for line in lines[:15]:
        line = line.strip()
        if not line or len(line) > 80:
            continue
        if any(line.lower().startswith(skip) for skip in skip_words):
            continue
        if re.match(r'^[A-Z\s:]+$', line) and len(line) < 20:
            continue
        if len(line) > 1:
            return line
    return ""


async def _analyze_deck_internal(deck_text: str) -> dict:
    """Core analysis pipeline, shared by REST endpoint and CopilotKit action."""
    from agents import shared_state
    from agents.orchestrator import create_orchestrator

    # Reset shared state for this analysis
    shared_state.analysis_state = {
        "claims": [], "fact_checks": [], "score": {},
        "memo": "", "audio_filename": "", "competitors": []
    }

    company_name = _extract_company_name(deck_text)
    _log(f"[Pipeline] Extracted company name: '{company_name}'")
    _log(f"[Pipeline] Deck text length: {len(deck_text)} chars")

    try:
        # Create a FRESH agent for each analysis — no memory from previous runs
        agent = create_orchestrator()
        agent(f"Analyze this pitch deck:\n\n{deck_text}")
        result = _build_response_from_shared_state(company_name)
        if result:
            claims_ok = isinstance(result.get("claims"), list) and len(result["claims"]) > 0
            memo_ok = isinstance(result.get("memo"), str) and len(result["memo"]) > 0
            score_ok = isinstance(result.get("score"), dict) and result["score"].get("overall", 0) > 0

            _log(f"[Pipeline] Validation: claims_ok={claims_ok} memo_ok={memo_ok} score_ok={score_ok}")

            if claims_ok and memo_ok and score_ok:
                _log("[Pipeline] RESULT ACCEPTED (full)")
                return result

            _log("[Pipeline] Partial results — falling back to saved data")
    except Exception as e:
        import traceback
        _log(f"[Pipeline] Error: {e}")
        traceback.print_exc()

    # Fallback: use fallback_response.json if available
    _log("[Pipeline] Using fallback response")
    fallback = _load_fallback_response()
    fallback["company_name"] = company_name or fallback.get("company_name", "")
    return fallback


# ── CopilotKit AG-UI Protocol via ag_ui_strands ──
# Uses the official Strands <-> CopilotKit bridge for proper AG-UI integration.
# The Strands agent has knowledge-graph tools; CopilotKit renders Generative UI
# for each tool call in the chat sidebar.

@strands_tool
def query_competitors(company_name: str) -> str:
    """Find competitors for a company in the knowledge graph. Returns competitor names, funding amounts, and market data."""
    from tools.neo4j_tools import find_competitors
    result = find_competitors(company_name)
    return str(result)


@strands_tool
def verify_founder_background(founder_name: str) -> str:
    """Verify a founder's background and experience in the knowledge graph."""
    from tools.neo4j_tools import verify_founder
    result = verify_founder(founder_name)
    return str(result)


@strands_tool
def check_market(market_name: str) -> str:
    """Check market size and growth data in the knowledge graph."""
    from tools.neo4j_tools import check_market_data
    result = check_market_data(market_name)
    return str(result)


# Create the Strands agent with knowledge-graph tools
_bedrock_model = StrandsBedrockModel(
    model_id="us.anthropic.claude-sonnet-4-20250514-v1:0",
    region_name=os.getenv("AWS_DEFAULT_REGION", "us-west-2"),
)

_strands_agent = StrandsNativeAgent(
    model=_bedrock_model,
    system_prompt="""You are DealGraph, an AI due diligence copilot. The analysis context is provided with each message.

CRITICAL RULES:
1. ALWAYS use your tools. The UI renders beautiful visual cards for each tool call. Your tools ARE the answer.
2. Keep text to 1-2 sentences MAX. The visual cards from tools are the primary output, not text.
3. NEVER write long paragraphs. Just call the tool and add a brief summary sentence after.
4. When asked about founders: call verify_founder_background for EACH founder name found in context.
5. When asked about competitors or funding: call query_competitors.
6. When asked about market: call check_market.
7. Do NOT repeat data that the tool will show in its visual card.
8. Do NOT use emojis.

Example good response to "tell me about the founders":
- Look at the analysis context to find founder names
- Call verify_founder_background for EACH founder name found
- Text: "Here are the verification results for both founders."

Example BAD response (DO NOT DO THIS):
- Writing 3 paragraphs about each founder's background from context without calling tools.""",
    tools=[query_competitors, verify_founder_background, check_market],
)

# StateContextBuilder: inject CopilotKit's useCopilotReadable context into the user message
# ag_ui_strands does NOT automatically pass the context field to the Strands agent,
# so we must manually prepend it to the user message.
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
        print(f"[CopilotKit] Injecting context ({len(context_block)} chars) into user message", file=sys.stderr, flush=True)
        return f"--- ANALYSIS CONTEXT FROM DASHBOARD ---\n{context_block}\n--- END CONTEXT ---\n\nUser question: {user_message}"

    print("[CopilotKit] No context found in input_data", file=sys.stderr, flush=True)
    return user_message


# Wrap for AG-UI protocol with context injection
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

# Agent info for CopilotKit discovery
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

    print(f"[CopilotKit] path='{path}' len={len(body_str)}", file=sys.stderr, flush=True)

    try:
        data = json.loads(body_str) if body_str else {}
    except json.JSONDecodeError:
        data = {}

    print(f"[CopilotKit] keys={list(data.keys())}", file=sys.stderr, flush=True)

    # CopilotKit sends JSON-RPC: {method, params, body}
    # The actual AG-UI fields (messages, thread_id, run_id) are nested inside "body"
    method = data.get("method", "")
    agent_data = data.get("body", data)  # fallback to top-level for direct AG-UI calls

    print(f"[CopilotKit] method='{method}' agent_data_keys={list(agent_data.keys()) if isinstance(agent_data, dict) else type(agent_data).__name__}", file=sys.stderr, flush=True)

    has_messages = isinstance(agent_data, dict) and "messages" in agent_data
    has_thread = isinstance(agent_data, dict) and "thread_id" in agent_data
    has_run = isinstance(agent_data, dict) and "run_id" in agent_data
    is_agent_run = has_messages or has_thread or has_run

    print(f"[CopilotKit] is_agent_run={is_agent_run} has_messages={has_messages} has_thread={has_thread} has_run={has_run}", file=sys.stderr, flush=True)

    if is_agent_run:
        # AG-UI agent run request — delegate to Strands agent
        print(f"[CopilotKit] Delegating to Strands agent via AG-UI", file=sys.stderr, flush=True)

        # Log messages to verify useCopilotReadable context is flowing through
        if has_messages:
            messages = agent_data.get("messages", [])
            print(f"[CopilotKit] Message count: {len(messages)}", file=sys.stderr, flush=True)
            for i, msg in enumerate(messages):
                role = msg.get("role", "unknown") if isinstance(msg, dict) else "?"
                content = str(msg.get("content", ""))[:200] if isinstance(msg, dict) else str(msg)[:200]
                print(f"[CopilotKit]   msg[{i}] role={role} content={content}", file=sys.stderr, flush=True)

        try:
            input_data = RunAgentInput(**agent_data)
        except Exception as e:
            print(f"[CopilotKit] RunAgentInput validation error: {e}", file=sys.stderr, flush=True)
            import traceback
            traceback.print_exc()
            return JSONResponse({"error": str(e)}, status_code=500)

        accept_header = request.headers.get("accept")
        encoder = EventEncoder(accept=accept_header)

        async def event_generator():
            try:
                async for event in _ag_ui_agent.run(input_data):
                    try:
                        encoded = encoder.encode(event)
                        print(f"[CopilotKit] SSE event: {str(encoded)[:120]}", file=sys.stderr, flush=True)
                        yield encoded
                    except Exception as e:
                        print(f"[CopilotKit] Encode error: {e}", file=sys.stderr, flush=True)
                        from ag_ui_protocol import RunErrorEvent, EventType
                        error_event = RunErrorEvent(
                            type=EventType.RUN_ERROR,
                            message=f"Encoding error: {str(e)}",
                            code="ENCODING_ERROR",
                        )
                        yield encoder.encode(error_event)
                        break
            except Exception as e:
                print(f"[CopilotKit] Agent run error: {e}", file=sys.stderr, flush=True)
                import traceback
                traceback.print_exc()

        return StreamingResponse(
            event_generator(),
            media_type=encoder.get_content_type(),
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # Info / discovery request — return available agents
    print(f"[CopilotKit] Returning agent info", file=sys.stderr, flush=True)
    return JSONResponse(_AGENT_INFO)


_log("[DealGraph] ag_ui_strands CopilotKit endpoint registered at /copilotkit")
print(f"[DealGraph] AG-UI agent: {_ag_ui_agent}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
