"""Claim Router — classifies extracted claims for dispatch to the right resolver.

Each claim is tagged as one of:
  - factual_static:  verifiable against known/cached graph data
  - factual_dynamic: verifiable via live web search (market stats, funding, traction)
  - qualitative:     requires subjective LLM judgment (team quality, moat, vision)
  - unverifiable:    forward-looking projections that cannot be verified today
"""

import json
import re
from typing import Literal

from strands import Agent
from model_config import get_model


ClaimCategory = Literal["factual_static", "factual_dynamic", "qualitative", "unverifiable"]

ROUTER_PROMPT = """You are a claim classifier for a venture capital due-diligence pipeline.

Given a JSON list of claims extracted from a pitch deck, classify EACH claim into
exactly ONE of these categories:

  factual_static  — Can be checked against a knowledge graph of known companies,
                     founders, and investors (e.g. "Brex raised $150M", "Founded by
                     ex-Googlers"). Use this ONLY when the claim references specific
                     entities that a curated database might contain.

  factual_dynamic — Can be verified with a live web search (e.g. "TAM is $50B",
                     "10,000 monthly active users", "Growing 20% MoM"). Market size,
                     traction metrics, revenue figures, and competitive landscape
                     claims belong here.

  qualitative     — Subjective and requires judgment, not hard data (e.g. "deep domain
                     expertise", "strong product-market fit", "unique moat"). Team
                     quality assessments without specific credentials go here.

  unverifiable    — Forward-looking projections or aspirational statements that
                     cannot be checked today (e.g. "will 10x revenue next year",
                     "path to $1B ARR", "plan to expand to 50 countries").

Output a JSON list with the SAME claims, adding "category" and "routing_reason":

[
  {
    "id": <original id>,
    "text": "<original claim text>",
    "original_category": "<the category from the extractor>",
    "category": "factual_static | factual_dynamic | qualitative | unverifiable",
    "routing_reason": "<one sentence explaining the classification>"
  }
]

Rules:
- Preserve the original id and text exactly.
- When in doubt between factual_static and factual_dynamic, prefer factual_dynamic
  (web search is more likely to have data than a sparse graph).
- Output ONLY valid JSON. No markdown, no prose, no emojis."""


def _parse_claims(raw: str) -> list[dict] | None:
    """Extract a JSON list from potentially messy LLM output."""
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`")
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


def route_claims(claims_json: str) -> list[dict]:
    """Classify a JSON list of claims into routing categories.

    Returns the same list with added ``category`` and ``routing_reason`` fields.
    Falls back to 'factual_dynamic' when classification fails for a claim.
    """
    agent = Agent(
        model=get_model(),
        system_prompt=ROUTER_PROMPT,
        callback_handler=None,
    )

    response = agent(f"Classify these claims:\n\n{claims_json}")
    text = str(response).strip()
    parsed = _parse_claims(text)

    if isinstance(parsed, list):
        valid_cats = {"factual_static", "factual_dynamic", "qualitative", "unverifiable"}
        for c in parsed:
            if not isinstance(c, dict):
                continue
            cat = (c.get("category") or "").strip().lower().replace(" ", "_")
            if cat not in valid_cats:
                c["category"] = "factual_dynamic"
            else:
                c["category"] = cat
        return parsed

    # Fallback: return original claims tagged as factual_dynamic
    original = _parse_claims(claims_json)
    if isinstance(original, list):
        for c in original:
            if isinstance(c, dict):
                c["category"] = "factual_dynamic"
                c["routing_reason"] = "Classification failed; defaulting to web search"
        return original
    return []
