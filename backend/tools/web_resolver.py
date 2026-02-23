"""Web Resolver — verifies factual_dynamic claims via Tavily web search.

Uses the Tavily Search API to find live evidence for claims about
market size, traction metrics, competitor activity, and founder backgrounds.
Falls back gracefully when TAVILY_API_KEY is not set.
"""

from __future__ import annotations

import json
import os
import logging

logger = logging.getLogger("dealgraph.web_resolver")

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
WEB_ENABLED = bool(TAVILY_API_KEY)

_client = None


def _get_client():
    """Lazy-init the Tavily client (avoids import error when key is missing)."""
    global _client
    if _client is not None:
        return _client
    if not WEB_ENABLED:
        return None
    try:
        from tavily import TavilyClient
        _client = TavilyClient(api_key=TAVILY_API_KEY)
        return _client
    except Exception as e:
        logger.warning("Tavily client init failed: %s", e)
        return None


def _search(query: str, max_results: int = 5) -> list[dict]:
    """Run a Tavily search and return result dicts."""
    client = _get_client()
    if not client:
        return []
    try:
        resp = client.search(query=query, max_results=max_results, search_depth="basic")
        return resp.get("results", [])
    except Exception as e:
        logger.warning("Tavily search error for '%s': %s", query, e)
        return []


def search_competitors(company_name: str, market: str = "") -> list[dict]:
    """Find competitors for a company via web search."""
    query = f"{company_name} competitors"
    if market:
        query += f" {market} market"
    return _search(query)


def search_founder_background(founder_name: str) -> list[dict]:
    """Find background info on a founder via web search."""
    return _search(f"{founder_name} founder background experience")


def search_market_data(market_keyword: str) -> list[dict]:
    """Find TAM / market size / growth data via web search."""
    return _search(f"{market_keyword} market size TAM growth rate 2025 2026")


def resolve_claim(claim: dict) -> dict:
    """Verify a single factual_dynamic claim via web search.

    Returns an evidence dict with: claim_id, claim_text, raw_data, resolved, source.
    """
    if not WEB_ENABLED:
        return _empty(claim, "tavily_not_configured")

    text = (claim.get("text") or "").lower()
    original_cat = (claim.get("original_category") or claim.get("category") or "").lower()

    results: list[dict] = []

    if original_cat == "competition" or _mentions_any(text, ["competitor", "rival", "vs "]):
        entity = _extract_search_terms(claim)
        results = search_competitors(entity)
    elif original_cat == "team" or _mentions_any(text, ["founder", "ceo", "cto", "team"]):
        entity = _extract_search_terms(claim)
        results = search_founder_background(entity)
    elif original_cat in ("market_size", "market") or _mentions_any(text, ["tam", "market", "addressable"]):
        entity = _extract_search_terms(claim)
        results = search_market_data(entity)
    elif original_cat in ("traction", "financial") or _mentions_any(text, ["revenue", "arr", "user", "customer", "growth"]):
        results = _search(claim.get("text", "")[:200])
    else:
        results = _search(claim.get("text", "")[:200])

    snippets = [
        {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:300]}
        for r in results
    ]

    return {
        "claim_id": claim.get("id"),
        "claim_text": claim.get("text", ""),
        "raw_data": snippets,
        "resolved": len(snippets) > 0,
        "source": "web",
    }


def _mentions_any(text: str, keywords: list[str]) -> bool:
    return any(kw in text for kw in keywords)


def _extract_search_terms(claim: dict) -> str:
    """Pull the most searchable phrase from a claim."""
    import re
    text = claim.get("text") or ""
    m = re.search(r'["\']([^"\']{2,80})["\']', text)
    if m:
        return m.group(1)
    words = [w for w in text.split() if len(w) > 2]
    return " ".join(words[:6])


def _empty(claim: dict, reason: str) -> dict:
    return {
        "claim_id": claim.get("id"),
        "claim_text": claim.get("text", ""),
        "raw_data": [],
        "resolved": False,
        "source": "web",
        "skip_reason": reason,
    }
