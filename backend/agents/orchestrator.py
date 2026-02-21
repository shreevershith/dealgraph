import sys

from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from agents.claim_extractor import claim_extractor
from agents.fact_checker import fact_checker
from agents.deal_scorer import deal_scorer
from agents.memo_writer import memo_writer
from agents import shared_state


def _safe_print(msg: str):
    """Print that won't crash on Windows with emoji/unicode."""
    try:
        print(msg)
    except (UnicodeEncodeError, UnicodeDecodeError):
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _extract_text(response) -> str:
    """Extract plain text from a Strands AgentResult.

    Strands AgentResult.__str__ returns the text content directly.
    The .content attribute is Bedrock-format content blocks (list of dicts),
    which is NOT what we want for JSON parsing.
    """
    # Best: str() calls AgentResult.__str__ which returns clean text
    text = str(response)
    if text and text.strip():
        return text.strip()
    # Fallback: try to pull text from content blocks
    content = getattr(response, "content", None)
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and "text" in block:
                parts.append(block["text"])
            elif isinstance(block, str):
                parts.append(block)
        if parts:
            return "\n".join(parts).strip()
    if isinstance(content, str) and content.strip():
        return content.strip()
    # Last resort
    return repr(response)


@tool
def extract_claims(deck_text: str) -> str:
    """Extract all verifiable claims from pitch deck text."""
    response = claim_extractor(f"Extract all verifiable claims from this pitch deck:\n\n{deck_text}")
    out = _extract_text(response)
    _safe_print(f"[DEBUG extract_claims] type={type(response).__name__} len={len(out)} preview={out[:200]}")
    shared_state.analysis_state["claims"] = out
    return out


@tool
def fact_check_claims(claims_json: str) -> str:
    """Verify each claim against the knowledge graph."""
    response = fact_checker(f"Verify these claims against the knowledge graph:\n\n{claims_json}")
    out = _extract_text(response)
    _safe_print(f"[DEBUG fact_check_claims] type={type(response).__name__} len={len(out)} preview={out[:200]}")
    shared_state.analysis_state["fact_checks"] = out
    return out


@tool
def score_deal(fact_check_results: str) -> str:
    """Score the deal based on fact-check results."""
    response = deal_scorer(f"Score this deal based on these fact-check results:\n\n{fact_check_results}")
    out = _extract_text(response)
    _safe_print(f"[DEBUG score_deal] type={type(response).__name__} len={len(out)} preview={out[:200]}")
    # Don't overwrite shared_state["score"] — compute_deal_score already wrote
    # the structured JSON directly. The agent's prose would clobber it.
    if not shared_state.analysis_state.get("score"):
        shared_state.analysis_state["score"] = out
    return out


@tool
def write_memo(score_and_facts: str) -> str:
    """Write the investment memo and generate voice briefing."""
    response = memo_writer(f"Write the deal memo and voice briefing:\n\n{score_and_facts}")
    out = _extract_text(response)
    _safe_print(f"[DEBUG write_memo] type={type(response).__name__} len={len(out)} preview={out[:200]}")
    # Don't overwrite shared_state["memo"] — save_investment_memo already wrote
    # the structured memo text. The agent's closing prose would clobber it.
    if not shared_state.analysis_state.get("memo"):
        shared_state.analysis_state["memo"] = out
    return out


ORCHESTRATOR_PROMPT = """You are DealGraph, an AI due diligence copilot for investors.

When given pitch deck text, execute these steps IN ORDER:
1. Use extract_claims to pull out every verifiable claim
2. Use fact_check_claims to verify each claim against the knowledge graph
3. Use score_deal to compute the investment score
4. Use write_memo to generate the deal memo and voice briefing

After each step, briefly note what was found before moving to the next step.
Be thorough but concise. Investors value precision over verbosity.
Do NOT use emojis anywhere in your output."""

def create_orchestrator():
    """Create a fresh orchestrator agent (no memory from previous analyses)."""
    return Agent(
        model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
        system_prompt=ORCHESTRATOR_PROMPT,
        tools=[extract_claims, fact_check_claims, score_deal, write_memo]
    )
