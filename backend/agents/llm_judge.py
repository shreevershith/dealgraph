"""LLM Judge — assesses qualitative claims that require subjective reasoning.

Evaluates soft claims like "deep domain expertise" or "strong moat" using
the LLM's reasoning ability.  Returns a structured judgment with a
confidence score so the EvidenceNormalizer can weight it appropriately.
"""

import json
import re

from strands import Agent
from model_config import get_model


JUDGE_PROMPT = """You are a seasoned venture capital partner assessing qualitative claims
from a startup pitch deck.

For each claim, provide an honest, rigorous assessment.  You cannot verify these
with data — use your judgment based on what the claim implies and common patterns
in startup fundraising.

For EACH claim, output:
{
  "claim_id": <original id>,
  "assessment": "plausible | weak | strong | vague",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<2-3 sentences explaining your judgment>"
}

Assessment meanings:
  strong    — the claim, if true, represents a genuine competitive advantage
  plausible — reasonable claim but nothing exceptional; common in pitches
  weak      — claim is generic, unsubstantiated, or a stretch
  vague     — too ambiguous to assess meaningfully

Output a JSON list. No markdown, no emojis, ONLY valid JSON."""


def judge_claims(claims: list[dict]) -> list[dict]:
    """Assess a batch of qualitative claims.

    Returns a list of evidence dicts with judgment metadata.
    """
    if not claims:
        return []

    claims_text = json.dumps(claims, indent=2)
    agent = Agent(
        model=get_model(),
        system_prompt=JUDGE_PROMPT,
        callback_handler=None,
    )

    response = agent(f"Assess these qualitative claims:\n\n{claims_text}")
    text = str(response).strip()

    parsed = _parse_json_list(text)
    if not isinstance(parsed, list):
        return [_fallback(c) for c in claims]

    # Index judgments by claim_id
    judgments = {j.get("claim_id"): j for j in parsed if isinstance(j, dict)}

    results = []
    for claim in claims:
        cid = claim.get("id")
        j = judgments.get(cid, {})
        assessment = (j.get("assessment") or "vague").lower()
        if assessment not in ("strong", "plausible", "weak", "vague"):
            assessment = "vague"

        confidence = j.get("confidence", 0.5)
        if not isinstance(confidence, (int, float)):
            confidence = 0.5
        confidence = max(0.0, min(1.0, float(confidence)))

        results.append({
            "claim_id": cid,
            "claim_text": claim.get("text", ""),
            "raw_data": {
                "assessment": assessment,
                "reasoning": j.get("reasoning", ""),
            },
            "resolved": True,
            "source": "llm_judgment",
            "confidence_override": confidence,
        })

    return results


def _fallback(claim: dict) -> dict:
    return {
        "claim_id": claim.get("id"),
        "claim_text": claim.get("text", ""),
        "raw_data": {"assessment": "vague", "reasoning": "Judgment unavailable"},
        "resolved": False,
        "source": "llm_judgment",
        "confidence_override": 0.3,
    }


def _parse_json_list(text: str) -> list | None:
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
