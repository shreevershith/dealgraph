"""Evidence Normalizer — standardizes raw resolver outputs into a uniform schema.

Each piece of evidence gets: status, source, freshness, confidence, and
supporting_data.  The DealScorer consumes these normalized records for
confidence-aware scoring.
"""

from __future__ import annotations


# Confidence baselines by source
_SOURCE_CONFIDENCE = {
    "graph": 0.85,
    "web": 0.70,
    "llm_judgment": 0.50,
    "none": 0.0,
}


def normalize(evidence_list: list[dict], classified_claims: list[dict]) -> list[dict]:
    """Normalize a batch of raw evidence dicts into the standard schema.

    ``classified_claims`` is the ClaimRouter output (used to carry over routing metadata).
    """
    claim_map = {c.get("id"): c for c in classified_claims if isinstance(c, dict)}
    normalized = []

    for ev in evidence_list:
        cid = ev.get("claim_id")
        claim_meta = claim_map.get(cid, {})
        source = ev.get("source", "none")
        resolved = ev.get("resolved", False)
        raw = ev.get("raw_data")

        # Determine status
        status = _derive_status(ev, claim_meta)

        # Determine confidence
        confidence = _derive_confidence(ev, source, resolved, status)

        # Determine freshness
        freshness = _derive_freshness(source, resolved)

        # Build supporting_data summary
        supporting = _summarize(raw, source)

        normalized.append({
            "claim_id": cid,
            "claim_text": ev.get("claim_text", claim_meta.get("text", "")),
            "category": claim_meta.get("category", "unknown"),
            "status": status,
            "source": source,
            "freshness": freshness,
            "confidence": round(confidence, 2),
            "supporting_data": supporting,
        })

    return normalized


def _derive_status(ev: dict, claim_meta: dict) -> str:
    """Map raw evidence into one of: verified, contradicted, unverified, flagged."""
    cat = claim_meta.get("category", "")

    if cat == "unverifiable":
        return "flagged"

    if not ev.get("resolved", False):
        return "unverified"

    source = ev.get("source", "")
    raw = ev.get("raw_data")

    if source == "llm_judgment" and isinstance(raw, dict):
        assessment = raw.get("assessment", "")
        if assessment in ("strong", "plausible"):
            return "verified"
        if assessment == "weak":
            return "contradicted"
        return "unverified"

    if source in ("graph", "web") and raw:
        return "verified"

    return "unverified"


def _derive_confidence(ev: dict, source: str, resolved: bool, status: str) -> float:
    """Compute a confidence score (0.0 - 1.0)."""
    # LLM judge provides its own confidence
    if "confidence_override" in ev:
        return float(ev["confidence_override"])

    base = _SOURCE_CONFIDENCE.get(source, 0.3)

    if not resolved:
        return max(0.1, base * 0.3)

    if status == "contradicted":
        return base * 0.9  # high confidence in the contradiction

    if status == "flagged":
        return 0.15

    # Boost confidence when multiple data points are returned
    raw = ev.get("raw_data", [])
    if isinstance(raw, list) and len(raw) > 2:
        base = min(1.0, base + 0.1)

    return base


def _derive_freshness(source: str, resolved: bool) -> str:
    if not resolved:
        return "unknown"
    if source == "web":
        return "current"
    if source == "graph":
        return "recent"
    return "unknown"


def _summarize(raw, source: str) -> str:
    """Create a human-readable summary of the raw evidence."""
    if not raw:
        return "No supporting data found."

    if source == "llm_judgment" and isinstance(raw, dict):
        return raw.get("reasoning", "No reasoning provided.")

    if isinstance(raw, list):
        parts = []
        for item in raw[:3]:
            if isinstance(item, dict):
                # Web results
                if "snippet" in item:
                    title = item.get("title", "")
                    snippet = item.get("snippet", "")[:150]
                    parts.append(f"{title}: {snippet}" if title else snippet)
                # Graph results
                elif "name" in item:
                    parts.append(str(item))
        return " | ".join(parts) if parts else str(raw)[:300]

    return str(raw)[:300]
