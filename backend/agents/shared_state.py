"""Request-isolated state for pipeline results.

Uses contextvars so concurrent requests don't corrupt each other.
asyncio.to_thread copies the context, so tools running inside a
Strands Agent thread see (and mutate) the same dict that the
calling async handler set up.

State keys:
  claims             — raw extracted claims (JSON string from ClaimExtractor)
  classified_claims  — ClaimRouter output (list of dicts with category)
  evidence           — normalized evidence from all resolvers (list of dicts)
  web_search_results — raw Tavily results for frontend display
  fact_checks        — legacy compatibility alias for evidence
  score              — deal score JSON
  memo               — investment memo text
  audio_filename     — generated audio file name
  competitors        — competitor list for D3 graph visualization
"""

import contextvars
from copy import deepcopy

_DEFAULT = {
    "claims": [],
    "classified_claims": [],
    "evidence": [],
    "web_search_results": [],
    "fact_checks": [],
    "score": {},
    "memo": "",
    "audio_filename": "",
    "competitors": [],
}

_ctx: contextvars.ContextVar[dict] = contextvars.ContextVar("analysis_state")


class _ContextDict:
    """Dict-like wrapper backed by a ContextVar for per-request isolation.

    Existing code does `shared_state.analysis_state["key"] = val` and
    `shared_state.analysis_state.get("key")` — this class supports both
    without changing call sites.
    """

    def _state(self) -> dict:
        try:
            return _ctx.get()
        except LookupError:
            s = deepcopy(_DEFAULT)
            _ctx.set(s)
            return s

    def __getitem__(self, key):
        return self._state()[key]

    def __setitem__(self, key, value):
        self._state()[key] = value

    def get(self, key, default=None):
        return self._state().get(key, default)

    def __repr__(self):
        return repr(self._state())


analysis_state = _ContextDict()


def reset_state() -> dict:
    """Create a fresh analysis state for the current request context."""
    state = deepcopy(_DEFAULT)
    _ctx.set(state)
    return state
