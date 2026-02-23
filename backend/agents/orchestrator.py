"""Pipeline orchestrator — claim-routed verification with confidence-aware scoring.

Flow:  PitchDeck -> ClaimExtractor -> ClaimRouter
         -> GraphResolver  (factual_static)
         -> WebResolver    (factual_dynamic)
         -> LLMJudge       (qualitative)
         -> Flag           (unverifiable)
       -> EvidenceNormalizer -> DealScorer -> MemoWriter
"""

import json
import re

from strands import Agent, tool
from agents.claim_extractor import claim_extractor
from agents.claim_router import route_claims
from agents.llm_judge import judge_claims
from agents.evidence_normalizer import normalize as normalize_evidence
from agents.deal_scorer import deal_scorer
from agents.memo_writer import memo_writer
from agents import shared_state
from tools.graph_resolver import resolve_claim as graph_resolve
from tools.web_resolver import resolve_claim as web_resolve
from model_config import get_model


def _safe_print(msg: str):
    """Print that won't crash on Windows with emoji/unicode."""
    try:
        print(msg)
    except (UnicodeEncodeError, UnicodeDecodeError):
        print(msg.encode("ascii", errors="replace").decode("ascii"))


def _extract_text(response) -> str:
    """Extract plain text from a Strands AgentResult."""
    text = str(response)
    if text and text.strip():
        return text.strip()
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
    return repr(response)


def _parse_json(text: str):
    """Extract JSON from agent output that may be wrapped in markdown."""
    if not text:
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
    return None


# ── Step 1: Extract claims ──

@tool
def extract_claims(text: str) -> str:
    """Extract all verifiable claims from pitch deck text. Pass the full deck text."""
    response = claim_extractor(f"Extract all verifiable claims from this pitch deck:\n\n{text}")
    out = _extract_text(response)
    _safe_print(f"[Pipeline] extract_claims: len={len(out)}")
    shared_state.analysis_state["claims"] = out
    return out


# ── Steps 2-4: Route claims -> Resolve evidence -> Normalize ──

@tool
def verify_claims(claims_json: str) -> str:
    """Route each claim to the appropriate resolver and collect normalized evidence.
    Pass the JSON claims from extract_claims."""
    _safe_print("[Pipeline] verify_claims: routing claims...")

    # Step 2: Route claims
    classified = route_claims(claims_json)
    shared_state.analysis_state["classified_claims"] = classified
    _safe_print(f"[Pipeline] ClaimRouter: {len(classified)} claims classified")

    # Step 3: Dispatch to resolvers
    raw_evidence: list[dict] = []
    qualitative_batch: list[dict] = []

    for claim in classified:
        cat = claim.get("category", "factual_dynamic")

        if cat == "factual_static":
            ev = graph_resolve(claim)
            # Fall through to web if graph returned nothing
            if not ev.get("resolved"):
                ev = web_resolve(claim)
            raw_evidence.append(ev)

        elif cat == "factual_dynamic":
            ev = web_resolve(claim)
            raw_evidence.append(ev)

        elif cat == "qualitative":
            qualitative_batch.append(claim)

        elif cat == "unverifiable":
            raw_evidence.append({
                "claim_id": claim.get("id"),
                "claim_text": claim.get("text", ""),
                "raw_data": [],
                "resolved": False,
                "source": "none",
            })

    # Batch-process qualitative claims
    if qualitative_batch:
        judgments = judge_claims(qualitative_batch)
        raw_evidence.extend(judgments)

    # Stash raw web results for frontend display
    web_results = [
        ev.get("raw_data", [])
        for ev in raw_evidence
        if ev.get("source") == "web" and ev.get("resolved")
    ]
    shared_state.analysis_state["web_search_results"] = web_results

    # Step 4: Normalize
    evidence = normalize_evidence(raw_evidence, classified)
    shared_state.analysis_state["evidence"] = evidence
    # Keep backward compat with old fact_checks field
    shared_state.analysis_state["fact_checks"] = json.dumps(evidence)

    summary = _build_evidence_summary(evidence)
    _safe_print(f"[Pipeline] EvidenceNormalizer: {len(evidence)} items normalized")

    return summary


def _build_evidence_summary(evidence: list[dict]) -> str:
    """Build a text summary of evidence for the DealScorer to consume."""
    lines = []
    for ev in evidence:
        status = ev.get("status", "unverified")
        conf = ev.get("confidence", 0)
        source = ev.get("source", "none")
        text = ev.get("claim_text", "")[:100]
        supporting = ev.get("supporting_data", "")[:150]
        lines.append(
            f"[{status.upper()} | confidence={conf} | source={source}] "
            f"{text} -- {supporting}"
        )
    return "\n".join(lines)


# ── Step 5: Score ──

@tool
def score_deal(evidence_summary: str) -> str:
    """Score the deal based on verified evidence. Pass the output from verify_claims."""
    response = deal_scorer(f"Score this deal based on these evidence results:\n\n{evidence_summary}")
    out = _extract_text(response)
    _safe_print(f"[Pipeline] score_deal: len={len(out)}")
    return out


# ── Step 6: Memo ──

@tool
def write_memo(text: str) -> str:
    """Write the investment memo and generate voice briefing. Pass the score and evidence as a single string."""
    response = memo_writer(f"Write the deal memo and voice briefing:\n\n{text}")
    out = _extract_text(response)
    _safe_print(f"[Pipeline] write_memo: len={len(out)}")
    return out


ORCHESTRATOR_PROMPT = """You are DealGraph, an AI due diligence copilot for investors.

When given pitch deck text, execute these steps IN ORDER:
1. Use extract_claims to pull out every verifiable claim
2. Use verify_claims to route each claim to the right resolver and collect evidence
3. Use score_deal to compute the confidence-weighted investment score
4. Use write_memo to generate the deal memo and voice briefing

After each step, briefly note what was found before moving to the next step.
Be thorough but concise. Investors value precision over verbosity.
Do NOT use emojis anywhere in your output."""


def create_orchestrator():
    """Create a fresh orchestrator agent (no memory from previous analyses)."""
    return Agent(
        model=get_model(),
        system_prompt=ORCHESTRATOR_PROMPT,
        tools=[extract_claims, verify_claims, score_deal, write_memo],
    )
