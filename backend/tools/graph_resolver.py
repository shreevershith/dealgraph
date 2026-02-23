"""Graph Resolver — verifies factual_static claims against the Memgraph knowledge graph.

Wraps the existing neo4j_tools query functions and returns structured evidence
dicts that the EvidenceNormalizer can consume.
"""

from __future__ import annotations

from tools.neo4j_tools import (
    find_competitors,
    verify_founder,
    check_market_data,
    GRAPH_ENABLED,
)


def resolve_claim(claim: dict) -> dict:
    """Attempt to verify a single claim using the graph.

    Returns an evidence dict with keys: claim, raw_data, resolved, source.
    ``resolved`` is True when the graph returned at least one matching record.
    """
    if not GRAPH_ENABLED:
        return _empty(claim, "graph_disabled")

    text = (claim.get("text") or "").lower()
    original_cat = (claim.get("original_category") or claim.get("category") or "").lower()

    # Competitor / competition claims
    if original_cat == "competition" or _mentions_any(text, ["competitor", "compet", "rival", "vs ", "versus"]):
        company = _extract_entity(claim)
        data = find_competitors(company) if company else []
        return _evidence(claim, data)

    # Team / founder claims
    if original_cat == "team" or _mentions_any(text, ["founder", "ceo", "cto", "team", "experience", "background"]):
        person = _extract_entity(claim)
        data = verify_founder(person) if person else []
        return _evidence(claim, data)

    # Market size claims
    if original_cat in ("market_size", "market") or _mentions_any(text, ["tam", "market size", "addressable", "market growth"]):
        kw = _extract_entity(claim)
        data = check_market_data(kw) if kw else []
        return _evidence(claim, data)

    # Generic: try competitor lookup as a catch-all
    entity = _extract_entity(claim)
    if entity:
        data = find_competitors(entity)
        return _evidence(claim, data)

    return _empty(claim, "no_entity_found")


def _mentions_any(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def _extract_entity(claim: dict) -> str:
    """Best-effort entity extraction from claim text (first quoted string or capitalized phrase)."""
    import re
    text = claim.get("text") or ""
    # Try quoted strings first
    m = re.search(r'["\']([^"\']{2,60})["\']', text)
    if m:
        return m.group(1)
    # Try capitalized multi-word phrases (likely proper nouns)
    m = re.search(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b", text)
    if m:
        return m.group(1)
    # Fall back to first 3 meaningful words
    words = [w for w in text.split() if len(w) > 2]
    return " ".join(words[:3])


def _evidence(claim: dict, data: list) -> dict:
    return {
        "claim_id": claim.get("id"),
        "claim_text": claim.get("text", ""),
        "raw_data": data,
        "resolved": len(data) > 0,
        "source": "graph",
    }


def _empty(claim: dict, reason: str) -> dict:
    return {
        "claim_id": claim.get("id"),
        "claim_text": claim.get("text", ""),
        "raw_data": [],
        "resolved": False,
        "source": "graph",
        "skip_reason": reason,
    }
